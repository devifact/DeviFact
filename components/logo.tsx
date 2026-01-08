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
    <span className={`inline-flex items-center ${className}`}>
      <Image
        src="/logo.svg"
        alt="DevisFact"
        width={width}
        height={height}
        className="logo-light"
        priority
      />
      <Image
        src="/logo-dark.svg"
        alt="DevisFact"
        width={width}
        height={height}
        className="logo-dark"
        priority
      />
    </span>
  );
}
