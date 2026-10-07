import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { MaxBytes } from '../../common/validators/max-bytes.decorator.js';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  // bcrypt only uses the first 72 *bytes*; longer inputs are rejected instead
  // of being silently truncated (non-ASCII characters take 2-4 bytes each).
  @IsString()
  @MinLength(1)
  @MaxBytes(72)
  password: string;
}
