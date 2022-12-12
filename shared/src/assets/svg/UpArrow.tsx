import { SVGProps } from '.';

export default function UpArrow(props: SVGProps) {
  return (
    <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
      <path
        d='M3.33331 8.07054L7.99998 3.40387L12.6666 8.07054M8 12.7372V3.40387'
        stroke='#00C143'
        strokeWidth='1.25'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}
