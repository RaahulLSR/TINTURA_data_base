
import React from 'react';
import { ExternalLink, FileText, Download } from 'lucide-react';
import { Attachment } from '../../types';

export const AttachmentGallery: React.FC<{ attachments: Attachment[] }> = ({ attachments }) => {
  const images = attachments.filter(a => a.type === 'image');
  const docs = attachments.filter(a => a.type === 'document');
  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {images.map((img, idx) => (
            <a key={idx} href={img.url} target="_blank" rel="noreferrer" className="relative group/img aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-sm block bg-slate-100">
              <img src={img.url} className="w-full h-full object-cover transition-transform group-hover/img:scale-110" alt={img.name}/>
              <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                <ExternalLink size={24} className="text-white"/>
              </div>
            </a>
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc, idx) => (
            <a key={idx} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 transition-all">
              <div className="flex items-center gap-2 truncate pr-4">
                <FileText size={16} className="text-indigo-500"/>
                <span className="text-xs font-bold text-slate-700 truncate">{doc.name}</span>
              </div>
              <Download size={16} className="text-slate-400"/>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
