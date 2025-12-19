import React from 'react';
import type { Card as CardType } from '../types';
import { SUIT_SYMBOLS, SUIT_COLORS } from '../types';
import './Card.css';

interface CardProps {
  card: CardType | null;
  hidden?: boolean;
  small?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, hidden = false, small = false }) => {
  if (!card || hidden) {
    return (
      <div className={`card card-back ${small ? 'card-small' : ''}`}>
        <div className="card-pattern"></div>
      </div>
    );
  }
  
  const color = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];
  
  return (
    <div className={`card ${small ? 'card-small' : ''}`} style={{ color }}>
      <div className="card-corner top-left">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{symbol}</span>
      </div>
      <div className="card-center">
        <span className="card-suit-large">{symbol}</span>
      </div>
      <div className="card-corner bottom-right">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{symbol}</span>
      </div>
    </div>
  );
};
