import React from 'react';
import { FeeTier, PrintFeeTier } from '../../data/BlendPoolMarkers';
import RoundedBadge from './RoundedBadge';

export type FeeTierProps = {
  feeTier: FeeTier;
  className?: string;
};

export default function FeeTierContainer(props: FeeTierProps) {
  const { feeTier, className } = props;
  return (
    <RoundedBadge className={className}>
      Uniswap Fee Tier - {PrintFeeTier(feeTier)}
    </RoundedBadge>
  );
}
