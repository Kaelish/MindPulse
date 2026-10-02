import React from 'react';
import logoImage from '../assets/logo.png';

interface BrandLogoProps {
  className?: string;
}

export const BrandLogo = ({ className }: BrandLogoProps) => (
  <img className={className} src={logoImage} alt="" aria-hidden="true" />
);
