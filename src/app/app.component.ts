import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SpinnerComponent } from './theme/shared/components/spinner/spinner.component';
import { BotComponent } from './chatbot/bot/bot.component';
// import { HeaderComponent } from './core/components/header/header.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [RouterOutlet, SpinnerComponent, BotComponent]
})
export class AppComponent {
  title = 'NGN ERP System';
}
