import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideArrowRight,
  LucideEye,
  LucideEyeOff,
  LucideLockKeyhole,
  LucideServer,
  LucideUserRound,
} from '@lucide/angular';
import { apiErrorMessage } from '../../core/api/error-message';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    LucideArrowRight,
    LucideEye,
    LucideEyeOff,
    LucideLockKeyhole,
    LucideServer,
    LucideUserRound,
  ],
  templateUrl: './login.html',
})
export class LoginPage {
  username = '';
  password = '';
  serverUrl: string;
  readonly showPassword = signal(false);
  readonly showServer = signal(false);
  readonly error = signal('');

  constructor(
    readonly auth: AuthService,
    readonly api: ApiService,
  ) {
    this.serverUrl = api.baseUrl();
  }

  async submit(): Promise<void> {
    if (!this.username.trim() || !this.password) return;
    this.error.set('');
    try {
      await this.auth.login(this.username, this.password);
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Sign in failed.'));
    }
  }

  saveServer(): void {
    this.api.setBaseUrl(this.serverUrl);
    this.showServer.set(false);
  }
}
