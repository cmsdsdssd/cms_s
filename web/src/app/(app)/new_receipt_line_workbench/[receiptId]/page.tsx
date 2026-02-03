import ReceiptLineWorkbench from "../receipt-line-workbench";

type PageProps = {
  params: { receiptId: string };
};

export default function NewReceiptLineWorkbenchReceiptPage({ params }: PageProps) {
  return <ReceiptLineWorkbench initialReceiptId={params.receiptId} />;
}
