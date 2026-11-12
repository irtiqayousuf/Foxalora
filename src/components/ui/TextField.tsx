"use client";

import { Field, Input, type InputProps } from "@fluentui/react-components";

type TextFieldProps = InputProps & {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

/** Labeled input with hint and validation message, built on Fluent Field. */
export function TextField({ label, hint, error, required, ...inputProps }: TextFieldProps) {
  return (
    <Field
      label={label}
      hint={hint}
      required={required}
      validationState={error ? "error" : "none"}
      validationMessage={error}
    >
      <Input {...inputProps} />
    </Field>
  );
}
