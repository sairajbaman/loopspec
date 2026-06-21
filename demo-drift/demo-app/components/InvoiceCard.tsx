// components/InvoiceCard.tsx
// DELIBERATELY BROKEN: Default export, 'any' types, prop drilling (too many props)

import { useState } from 'react';

interface InvoiceCardProps {
  invoice: any;                        // 'any' type - should be typed
  onEdit: any;                         // 'any' type
  onDelete: any;                       // 'any' type
  onDuplicate: any;                    // 'any' type
  onMarkAsPaid: any;                   // 'any' type
  onSendReminder: any;                 // 'any' type
  onDownloadPdf: any;                  // 'any' type
  onShare: any;                        // 'any' type
  onArchive: any;                      // 'any' type
  showActions: boolean;
  compact: boolean;
  currency: string;
  locale: string;
}

// Default export - violates SKILL.md convention
// @ts-ignore - violates strict mode
export default function InvoiceCard({
  invoice,
  onEdit,
  onDelete,
  onDuplicate,
  onMarkAsPaid,
  onSendReminder,
  onDownloadPdf,
  onShare,
  onArchive,
  showActions,
  compact,
  currency,
  locale,
}: InvoiceCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Missing: loading state
  // Missing: error state
  // Missing: empty state

  return (
    <div>
      <h2>{invoice.client_name}</h2>
      <p>Amount: {invoice.amount}</p>
      {showActions && (
        <div>
          <button onClick={onEdit}>Edit</button>
          <button onClick={onDelete}>Delete</button>
        </div>
      )}
    </div>
  );
}
