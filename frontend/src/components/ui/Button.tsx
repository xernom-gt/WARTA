import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export default function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return <button className={`btn btn--${variant} ${className}`} {...rest} />;
}
