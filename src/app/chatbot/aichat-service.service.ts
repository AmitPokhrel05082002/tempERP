import { Injectable } from '@angular/core';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { environment } from 'src/environments/environment';
import { systemInstruction, history } from './app.constant';

@Injectable({
  providedIn: 'root',
})
export class AIChatServiceService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(environment.geminiApiKey); // Use your API key here
  }

  async sendMessage(message: string): Promise<any> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction,
    });

    const chatSession = model.startChat({
      generationConfig: {
        temperature: 0.8,
        topP: 0.9,
        topK: 50,
        maxOutputTokens: 1000,
        responseMimeType: 'text/plain',
      },
      history: history,
    });

    const result = await chatSession.sendMessage(message);

    // console.log(result.response.text());
    return result.response.text();
  }
}
