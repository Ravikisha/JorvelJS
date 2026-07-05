import React from 'react';
import styles from './Card.module.css';

export function Card({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </div>
  );
}
