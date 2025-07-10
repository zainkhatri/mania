declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      allowTaint?: boolean;
      backgroundColor?: string;
      logging?: boolean;
      letterRendering?: boolean;
      imageTimeout?: number;
      removeContainer?: boolean;
      ignoreElements?: (element: HTMLElement) => boolean;
      onclone?: (doc: Document) => void;
    };
    jsPDF?: {
      unit?: string;
      format?: string;
      orientation?: string;
      compress?: boolean;
      precision?: number;
      hotfixes?: string[];
    };
  }

  interface Html2PdfInstance {
    from: (element: HTMLElement) => Html2PdfInstance;
    set: (options: Html2PdfOptions) => Html2PdfInstance;
    save: () => Promise<any>;
    output?: (type: string, options?: any) => any;
  }

  function html2pdf(): Html2PdfInstance;
  export = html2pdf;
} 