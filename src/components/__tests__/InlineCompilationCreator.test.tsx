import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';

import { InlineCompilationCreator } from '../InlineCompilationCreator';

jest.mock('@/contexts/LanguageProvider', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => {
      if (key === 'tagPanel.createWithin') return `Create a compilation within "${vars?.parent}"`;
      if (key === 'tagPanel.new') return 'New Compilation';
      if (key === 'common.cancel') return 'Cancel';
      if (key === 'common.save') return 'Save';
      return key;
    },
  }),
}));

describe('InlineCompilationCreator', () => {
  it('shows a parent-naming placeholder when creating a sub-compilation', () => {
    render(<InlineCompilationCreator parentName="Prayers" onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByPlaceholderText('Create a compilation within "Prayers"')).toBeTruthy();
  });

  it('falls back to a parent-less placeholder for a top-level compilation', () => {
    render(<InlineCompilationCreator parentName={null} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByPlaceholderText('New Compilation')).toBeTruthy();
  });

  it('calls onSave with the trimmed name when Save is pressed', () => {
    const onSave = jest.fn();
    render(<InlineCompilationCreator parentName="Prayers" onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Create a compilation within "Prayers"'), {
      target: { value: '  Short Obligatory  ' },
    });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('Short Obligatory');
  });

  it('does not call onSave when the name is empty or whitespace-only', () => {
    const onSave = jest.fn();
    render(<InlineCompilationCreator parentName={null} onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('New Compilation'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();
    render(<InlineCompilationCreator parentName={null} onSave={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
