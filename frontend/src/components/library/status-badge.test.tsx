import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders published label', () => {
    render(<StatusBadge status="PUBLISHED" />);
    expect(screen.getByText('Publié')).toBeInTheDocument();
  });

  it('renders pending label', () => {
    render(<StatusBadge status="PENDING_VALIDATION" />);
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });
});
