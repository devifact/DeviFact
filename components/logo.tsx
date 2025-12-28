import Image from 'next/image';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const sizes = {
  small: { width: 140, height: 40 },
  medium: { width: 210, height: 60 },
  large: { width: 420, height: 120 },
};

export function Logo({ size = 'small', className = '' }: LogoProps) {
  const { width, height } = sizes[size];

  return (
    <Image
      src="/logo.svg"
      alt="DevisFact"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
