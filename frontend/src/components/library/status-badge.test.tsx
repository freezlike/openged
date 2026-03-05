import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { i18n } from '../../i18n';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders published label', () => {
    render(<StatusBadge status="PUBLISHED" />);
    expect(screen.getByText(i18n.t('status.published', { ns: 'common' }))).toBeInTheDocument();
  });

  it('renders pending label', () => {
    render(<StatusBadge status="PENDING_VALIDATION" />);
    expect(screen.getByText(i18n.t('status.pending', { ns: 'common' }))).toBeInTheDocument();
  });
});
