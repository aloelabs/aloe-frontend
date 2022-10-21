import { SVGProps } from '.';

export default function DropdownArrowUp(props: SVGProps) {
  return (
    <svg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
      <path
        d='M5 7.5L10 12.5L15 7.5'
        stroke='white'
        strokeWidth='1.66667'
        strokeLinecap='round'
        strokeLinejoin='round'
        transform='scale(1,-1)'
        transform-origin='center'
      />
    </svg>
  );
}
