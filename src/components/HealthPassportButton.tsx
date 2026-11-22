import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { downloadHealthPassportPdf, getErrorMessage } from '../api';

interface HealthPassportButtonProps {
  onError?: (message: string | null) => void;
}

export const HealthPassportButton: React.FC<HealthPassportButtonProps> = ({ onError }) => {
  const [exporting, setExporting] = useState(false);

  const handleDownload = async () => {
    setExporting(true);
    onError?.(null);
    try {
      await downloadHealthPassportPdf();
    } catch (err) {
      onError?.(getErrorMessage(err, 'Unable to export Portable Health Passport.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      disabled={exporting}
      onClick={() => void handleDownload()}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
      ) : (
        <Download className="w-4 h-4 text-teal-700" />
      )}
      <span>{exporting ? 'Generating PDF...' : 'Download Health Passport'}</span>
    </button>
  );
};
