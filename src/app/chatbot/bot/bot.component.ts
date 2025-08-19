import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  HostListener,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { HttpClientModule } from '@angular/common/http';
import { AIChatServiceService } from '../aichat-service.service';
import { marked } from 'marked';

interface SafeMessage {
  text: string | SafeHtml;
  sender: 'user' | 'bot';
}

@Component({
  selector: 'app-bot',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './bot.component.html',
  styleUrls: ['./bot.component.scss'],
})
export class BotComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  @ViewChild('userInputField') userInputField!: ElementRef;

  chatOpen: boolean = false;
  showInitialMessage: boolean = true;
  showDefaultPrompts: boolean = true;
  typingMessage: string = '';
  isBotTyping: boolean = false;
  isProcessing: boolean = false;
  private typingSubscription: Subscription | null = null;
  private typingInterval: any;
  messages: SafeMessage[] = [];
  userInput: string = '';
  private closeMessageTimeout: any;
  private debounceTimer: any;
  private resizeObserver: ResizeObserver | null = null;
  destroy: boolean = false;

  message: string = '';
  chatHistory: { sender: 'user' | 'bot'; text: string }[] = [];

  defaultPrompts: string[] = [
    'whats the sales contact details?',
    'What products are available?',
    'where is the main branch of the company?',
  ];

  private autoScrollEnabled: boolean = true;

  constructor(
    private sanitizer: DomSanitizer,
    private ngZone: NgZone,
    private aiChatService: AIChatServiceService
  ) {}

  initialMessage: any = {
    text: 'Kunzango and welcome to NGN Technologies. How can we assist you today?',
    sender: 'bot',
  };

  // Initialize the component and set up initial state
  ngOnInit() {
    this.chatHistory = [this.initialMessage];
    this.setAutoCloseMessage();
    this.setupResizeObserver();
    this.updateViewportHeight();

    window.addEventListener('resize', this.updateViewportHeight.bind(this));
  }

  // Clean up subscriptions, intervals, and listeners on component destruction
  ngOnDestroy() {
    if (this.closeMessageTimeout) {
      clearTimeout(this.closeMessageTimeout);
    }
    this.typingSubscription?.unsubscribe();
    clearInterval(this.typingInterval);
    this.cleanupResizeObserver();

    window.removeEventListener('resize', this.updateViewportHeight.bind(this));
  }

  // Automatically scroll to the bottom of the messages container after view updates
  ngAfterViewChecked() {
    if (this.autoScrollEnabled) {
      this.scrollToBottom();
    }
  }

  // Handle scroll events to determine if auto-scrolling should be enabled
  @HostListener('scroll', ['$event'])
  onScroll(event: Event) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const element = this.messagesContainer.nativeElement;
      this.autoScrollEnabled =
        element.scrollHeight - element.scrollTop <= element.clientHeight + 100;
    }, 200);
  }

  // Adjust the chatbox layout when the input field gains focus (e.g., when the keyboard appears on mobile)
  @HostListener('window:focusin', ['$event'])
  onFocusIn(event: FocusEvent) {
    if (event.target instanceof HTMLInputElement) {
      this.adjustForKeyboard();
    }
  }

  // Reset the chatbox layout when the input field loses focus
  @HostListener('window:focusout', ['$event'])
  onFocusOut(event: FocusEvent) {
    if (event.target instanceof HTMLInputElement) {
      this.resetLayout();
    }
  }

  // Set up a resize observer to handle changes in the viewport size
  private setupResizeObserver() {
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.ngZone.run(() => this.updateChatboxHeight());
      });
      this.resizeObserver.observe(document.documentElement);
    }
  }

  // Clean up the resize observer when the component is destroyed
  private cleanupResizeObserver() {
    this.resizeObserver?.disconnect();
  }

  // Update the chatbox height based on the current viewport height
  private updateChatboxHeight() {
    const windowHeight = window.innerHeight;
    document.documentElement.style.setProperty(
      '--chat-height',
      `${windowHeight}px`
    );
  }

  // Adjust the layout to accommodate the on-screen keyboard
  private adjustForKeyboard() {
    document.body.classList.add('keyboard-visible');
    this.updateChatboxHeight();
  }

  // Reset the layout after the on-screen keyboard is dismissed
  private resetLayout() {
    document.body.classList.remove('keyboard-visible');
    this.updateChatboxHeight();
  }

  // Automatically close the initial message after a delay
  private setAutoCloseMessage() {
    this.closeMessageTimeout = setTimeout(() => {
      this.showInitialMessage = false;
    }, 7000);
  }

  // Show the initial message when the chatbot icon is hovered over
  showInitialMessageOnHover() {
    if (!this.chatOpen && !this.showInitialMessage) {
      this.showInitialMessage = true;
    }
  }

  // Hide the initial message when the mouse leaves the chatbot icon
  hideInitialMessageOnLeave() {
    if (!this.chatOpen) {
      this.showInitialMessage = false;
    }
  }

  // Toggle the visibility of the chatbox
  toggleChat() {
    this.chatOpen = !this.chatOpen;
    this.showInitialMessage = false;
    if (this.chatOpen) {
      this.focusOnInputField();
    }
  }

  // Refresh the chat, resetting it to the initial state
  refreshChat() {
    this.chatHistory = [this.initialMessage];
    this.showDefaultPrompts = true;
    this.typingMessage = '';
    clearInterval(this.typingInterval);
    this.isBotTyping = false;
    this.autoScrollEnabled = true;
    this.scrollToBottom(true);
  }

  sendPromptMessage(text: string) {
    this.message = text;
    this.sendMessage(text);
  }

  // Send a message from the user and trigger a response from the bot
  sendMessage(text: string) {
    this.userInput = '';
    this.showDefaultPrompts = false;
    this.isBotTyping = true;

    const preprocessMarkdown = (
      markdown: string,
      useStrongTags: boolean = true
    ): string => {
      if (useStrongTags) {
        return markdown
          .replace(/^### (.*$)/gim, '<strong>$1</strong>')
          .replace(/^## (.*$)/gim, '<strong>$1</strong>')
          .replace(/^# (.*$)/gim, '<strong>$1</strong>');
      }
      return markdown;
    };

    if (!this.message.trim()) {
      return;
    }

    // Add the user message to the chat history with 'bot-message' class
    this.chatHistory.push({ sender: 'user', text: this.message });

    // Clear the input field
    const userMessage = this.message;
    this.message = '';

    this.aiChatService
      .sendMessage(userMessage)
      .then((response) => {
        const markedDownText = preprocessMarkdown(response);
        const cleanedResponse: any = marked(markedDownText);
        this.generateResponse(cleanedResponse);
      })
      .catch((error) => {
        console.error('Error sending message:', error);
        this.chatHistory.push({
          sender: 'bot',
          text: 'Error: Unable to get a response.',
        });
      })
      .finally(() => {
        this.isBotTyping = false;
      });
  }

  // Generate a response from the bot by calling the chatbot service
  private generateResponse(text: string) {
    this.isProcessing = true;
    this.isBotTyping = true;
    // this.typingSubscription = this.chatbotService.sendMessage(text).subscribe(
    //   (response) => {
    //     this.isProcessing = false;
    //     const safeHtml: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    //       response.reply
    //     );
    this.startTypingEffect(text);
    //   },
    //   () => {
    //     this.isProcessing = false;
    //     this.isBotTyping = false;
    //     this.addBotMessage('Sorry, something went wrong. Please try again.');
    //   }
    // );
  }
  // Stop the bot's message generation and display the partially typed message
  stopGeneration() {
    if (this.typingSubscription) {
      this.typingSubscription.unsubscribe(); // Cancel the API request if ongoing
    }
    clearInterval(this.typingInterval); // Stop the typing interval
    this.isProcessing = false;
    this.isBotTyping = false;

    if (this.typingMessage) {
      this.addBotMessage(this.typingMessage); // Add the message that was partially typed
      this.typingMessage = ''; // Clear the typing message
    }

    this.focusOnInputField(); // Refocus the input field
    this.scrollToBottom(true); // Ensure scrolling to the bottom
  }

  // Create a typing effect for the bot's message
  private startTypingEffect(text: any) {
    const htmlString = this.sanitizer.sanitize(1, text) || '';
    let index = 0;
    let buffer = '';
    this.typingMessage = '';
    const typingSpeed = Math.max(15, 3000 / htmlString.length);

    const appendCompleteTags = (html: string) => {
      let tagOpened = false;
      for (const char of html) {
        buffer += char;
        if (char === '<') {
          tagOpened = true;
        } else if (char === '>') {
          tagOpened = false;
          this.typingMessage += buffer;
          buffer = '';
        } else if (!tagOpened) {
          this.typingMessage += buffer;
          buffer = '';
        }
      }
    };

    this.typingInterval = setInterval(() => {
      if (index < htmlString.length) {
        appendCompleteTags(htmlString[index]);
        index++;
        if (this.autoScrollEnabled) {
          this.scrollToBottom();
        }
      } else {
        clearInterval(this.typingInterval);
        if (buffer.length) {
          this.typingMessage += buffer;
        }
        this.chatHistory.push({ sender: 'bot', text: text });
        // console.log(this.chatHistory);
        // this.addBotMessage(this.typingMessage);
        this.typingMessage = '';
        this.isBotTyping = false;
        this.focusOnInputField();
        this.scrollToBottom(true);
      }
    }, typingSpeed);
  }

  // Add a message from the user to the chat
  private addUserMessage(text: string) {
    this.messages.push({ text, sender: 'user' });
    this.scrollToBottom(true);
  }

  // Add a message from the bot to the chat
  private addBotMessage(text: string | SafeHtml) {
    this.messages.push({ text, sender: 'bot' });
    this.scrollToBottom();
  }

  // Focus on the user input field
  private focusOnInputField() {
    setTimeout(() => {
      this.userInputField.nativeElement.focus();
    }, 0);
  }

  // Scroll to the bottom of the chat container
  private scrollToBottom(force: boolean = false): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      const atBottom =
        element.scrollHeight - element.scrollTop <= element.clientHeight + 100;

      if (atBottom || force) {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: force ? 'auto' : 'smooth',
        });
      }
    }
  }

  // Update the viewport height custom property based on the window height
  updateViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
}
