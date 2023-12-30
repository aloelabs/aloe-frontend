import { SVGProps } from '.';

export default function ArrowLeft(props: SVGProps) {
  return (
    <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
      <path d='M19 12H5' stroke='#070E12' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M12 19L5 12L12 5' stroke='#070E12' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}
