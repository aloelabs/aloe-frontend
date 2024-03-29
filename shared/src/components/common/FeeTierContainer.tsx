import React from 'react';

import RoundedBadge from './RoundedBadge';

import { FeeTier, PrintFeeTier } from '../../data/FeeTier';

export type FeeTierProps = {
  feeTier: FeeTier;
  className?: string;
};

export default function FeeTierContainer(props: FeeTierProps) {
  const { feeTier, className } = props;
  return <RoundedBadge className={className}>Uniswap Fee Tier - {PrintFeeTier(feeTier)}</RoundedBadge>;
}
