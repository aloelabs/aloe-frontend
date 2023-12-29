import { useEffect, useState } from 'react';

import Logo from 'shared/lib/assets/svg/AloeCapitalLogo';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { LAUNCH_DATE } from 'shared/lib/data/constants/Values';
import styled, { keyframes } from 'styled-components';

const generateRandomClip = () => {
  const top = Math.floor(Math.random() * 100);
  const bottom = Math.floor(Math.random() * 100);
  return `clip: rect(${top}px, 9999px, ${bottom}px, 0);`;
};

const generateRandomKeyframes = () => {
  let keyframes = '';
  for (let i = 0; i <= 100; i += 5) {
    keyframes += `${i}% { ${generateRandomClip()} transform: skew(${Math.random() * 2 - 1.8}deg); }\n`;
  }
  return keyframes;
};

const generateRandomFlicker = () => {
  let keyframes = '';
  const numberOfFlickers = 5;
  for (let i = 0; i < numberOfFlickers; i++) {
    const flickerStart = Math.floor(Math.random() * 100);
    const flickerEnd = Math.floor(Math.random() * 100);
    const flickerDuration = Math.floor(Math.random() * 10);
    const flickerDelay = Math.floor(Math.random() * 10);
    keyframes += `${flickerStart}% { opacity: 0.6; }\n`;
    keyframes += `${flickerStart + flickerDelay}% { opacity: 1; }\n`;
    keyframes += `${flickerStart + flickerDelay + flickerDuration}% { opacity: 1; }\n`;
    keyframes += `${flickerStart + flickerDelay + flickerDuration + flickerDelay}% { opacity: 0.6; }\n`;
    keyframes += `${flickerEnd}% { opacity: 0.6; }\n`;
  }
  return keyframes;
};

const flicker = keyframes`${generateRandomFlicker()}`;
const glitch1 = keyframes`${generateRandomKeyframes()}`;
const glitch2 = keyframes`${generateRandomKeyframes()}`;

const StyledAppPage = styled.div`
  width: 100%;
  height: calc(100vh - 128px);
  display: flex;
  justify-content: center;
  align-items: center;
`;

const GlitchDisplay = styled(Display)`
  position: relative;
  padding: 30px;
  animation: ${flicker} 8s infinite;

  &::before,
  &::after {
    color: white;
    padding: 30px;
    content: attr(data-text);
    position: absolute;
    width: 100%;
    height: 100%;
    background: transparent;
    overflow: hidden;
    top: 0;
  }

  &::before {
    left: 1.75px;
    animation: ${glitch1} 2.3s infinite, ${glitch2} 2s infinite;
    text-shadow: -1.75px 0 rgba(255, 0, 0, 0.6);
    opacity: 0.8;
  }

  &::after {
    left: -1.75px;
    animation: ${glitch2} 2.1s infinite, ${glitch1} 1.8s infinite;
    text-shadow: -1.75px 0 rgba(0, 0, 255, 0.6);
    opacity: 0.8;
  }
`;

const GlitchText = styled(Text)`
  position: relative;
  padding: 10px;
  animation: ${flicker} 8s infinite;

  &::before,
  &::after {
    color: white;
    padding: 10px;
    content: attr(data-text);
    position: absolute;
    width: 100%;
    height: 100%;
    background: transparent;
    overflow: hidden;
    top: 0;
  }

  &::before {
    left: 1px;
    animation: ${glitch1} 2.3s infinite, ${glitch2} 2s infinite;
    text-shadow: -1px 0 rgba(255, 0, 0, 0.6);
    opacity: 0.8;
  }

  &::after {
    left: -1px;
    animation: ${glitch2} 2.1s infinite, ${glitch1} 1.8s infinite;
    text-shadow: -1px 0 rgba(0, 0, 255, 0.6);
    opacity: 0.8;
  }
`;

const GlitchLogo = styled.div`
  position: relative;
  animation: ${flicker} 8s infinite;
`;

function CountdownTimer() {
  const currentDateStr = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const currentDate = new Date(currentDateStr);
  const [time, setTime] = useState(Math.floor((LAUNCH_DATE.getTime() - currentDate.getTime()) / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prevTime) => Math.max(prevTime - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (time <= 0) {
      window.location.reload();
    }
  }, [time]);

  const days = Math.floor(time / 86400)
    .toString()
    .padStart(2, '0');
  const hours = Math.floor((time % 86400) / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((time % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, '0');

  return (
    <div className='flex items-center justify-center'>
      <div className='flex flex-col items-center w-[100px] sm:w-[150px]'>
        <GlitchText size='M' data-text='Days' className='mb-[-30px] sm:mb-[-20px]'>
          Days
        </GlitchText>
        <GlitchDisplay size='XL' data-text={days}>
          {days}
        </GlitchDisplay>
      </div>
      <div className='flex flex-col items-center w-[100px] sm:w-[150px]'>
        <GlitchText size='M' data-text='Hours' className='mb-[-30px] sm:mb-[-20px]'>
          Hours
        </GlitchText>
        <GlitchDisplay size='XL' data-text={hours}>
          {hours}
        </GlitchDisplay>
      </div>
      <div className='flex flex-col items-center w-[100px] sm:w-[150px]'>
        <GlitchText size='M' data-text='Minutes' className='mb-[-30px] sm:mb-[-20px]'>
          Minutes
        </GlitchText>
        <GlitchDisplay size='XL' data-text={minutes}>
          {minutes}
        </GlitchDisplay>
      </div>
      <div className='flex flex-col items-center w-[100px] sm:w-[150px]'>
        <GlitchText size='M' data-text='Seconds' className='mb-[-30px] sm:mb-[-20px]'>
          Seconds
        </GlitchText>
        <GlitchDisplay size='XL' data-text={seconds}>
          {seconds}
        </GlitchDisplay>
      </div>
    </div>
  );
}

export default function CountdownPage() {
  return (
    <StyledAppPage>
      <div className='flex flex-col items-center justify-center'>
        <GlitchLogo>
          <Logo />
        </GlitchLogo>
        <CountdownTimer />
      </div>
    </StyledAppPage>
  );
}
