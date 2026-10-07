import { ValidateBy, type ValidationOptions } from 'class-validator';

// @MaxLength counts UTF-16 code units, not bytes: "ñ" is 1 character but
// 2 UTF-8 bytes. Use this when the limit comes from a byte-based consumer
// (bcrypt reads at most 72 bytes).
export function MaxBytes(
  max: number,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxBytes',
      constraints: [max],
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= max,
        defaultMessage: (args) =>
          `${args?.property ?? 'value'} must be at most ${max} bytes (UTF-8)`,
      },
    },
    options,
  );
}
