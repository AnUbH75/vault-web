import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SliderModule } from 'primeng/slider';
import { CheckboxModule } from 'primeng/checkbox';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS = new Set(['l', 'I', '1', 'O', '0']);

type Strength = 'weak' | 'medium' | 'strong';

@Component({
  selector: 'app-password-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, SliderModule, CheckboxModule],
  templateUrl: './password-generator.component.html',
  styleUrl: './password-generator.component.scss',
})
export class PasswordGeneratorComponent {
  @Output() passwordGenerated = new EventEmitter<string>();

  length = 16;
  useUpper = true;
  useLower = true;
  useNumbers = true;
  useSpecial = true;
  readableOnly = false;

  generated = '';
  error: string | null = null;

  constructor() {
    this.generate();
  }

  private buildPool(): string {
    let pool = '';
    if (this.useUpper) pool += UPPER;
    if (this.useLower) pool += LOWER;
    if (this.useNumbers) pool += NUMBERS;
    if (this.useSpecial) pool += SPECIAL;
    if (this.readableOnly) {
      pool = Array.from(pool)
        .filter((c) => !AMBIGUOUS.has(c))
        .join('');
    }
    return pool;
  }

  generate(): void {
    const pool = this.buildPool();
    if (!pool) {
      this.error = 'Select at least one character type.';
      this.generated = '';
      return;
    }
    this.error = null;
    const maxValid = Math.floor(256 / pool.length) * pool.length;
    const bytes = new Uint8Array(this.length * 2); // headroom for rejected draws
    crypto.getRandomValues(bytes);

    let result = '';
    let i = 0;
    while (result.length < this.length) {
      if (i >= bytes.length) {
        crypto.getRandomValues(bytes);
        i = 0;
      }
      const byte = bytes[i++];
      if (byte < maxValid) {
        result += pool[byte % pool.length];
      }
    }
    this.generated = result;
  }

  get strength(): Strength {
    const variety =
      Number(this.useUpper) +
      Number(this.useLower) +
      Number(this.useNumbers) +
      Number(this.useSpecial);
    const poolSize = this.buildPool().length || 1;
    const bits = this.length * Math.log2(poolSize);
    if (bits < 40 || variety < 2) return 'weak';
    if (bits < 70) return 'medium';
    return 'strong';
  }

  onOptionChange(): void {
    this.generate();
  }

  copyToInput(): void {
    if (this.generated) {
      this.passwordGenerated.emit(this.generated);
    }
  }
}
