import TallyForm from './components/TallyForm';

export default function TallyExample({ jcontext }) {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8 text-foreground">Contact Us</h1>
      <TallyForm formId="nPvaKV" title="Contact Form" hideTitle />
    </div>
  );
}
