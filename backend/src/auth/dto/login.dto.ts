import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  // bcrypt only uses the first 72 bytes; longer inputs are rejected instead
  // of being silently truncated.
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}
