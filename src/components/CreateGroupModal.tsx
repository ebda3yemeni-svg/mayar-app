import React, { useState } from 'react';
import { User } from '../types';
import { Users, Check, X } from 'lucide-react';
import { t } from '../i18n';

interface CreateGroupModalProps {
  contacts: User[];
  currentUser: User;
  onClose: () => void;
  onCreateGroup: (name: string, members: string[], description?: string) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  contacts,
  currentUser,
  onClose,
  onCreateGroup,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const toggleMember = (id: string) => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter((m) => m !== id));
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && selectedMembers.length > 0) {
      onCreateGroup(name, selectedMembers, description);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 select-none">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>{t('createGroup')}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('groupName')}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أسرة ميار 🌴"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('groupDescription')}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر لمجموعتك..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              {t('selectMembers')} ({selectedMembers.length})
            </label>
            <div className="max-h-48 overflow-y-auto space-y-2 divide-y divide-slate-700/60 bg-slate-900 p-2 rounded-xl border border-slate-700">
              {contacts.map((contact) => {
                const isSelected = selectedMembers.includes(contact.id);
                return (
                  <div
                    key={contact.id}
                    onClick={() => toggleMember(contact.id)}
                    className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <span className="text-xs font-bold text-white">{contact.name}</span>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-semibold"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || selectedMembers.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg disabled:opacity-50"
            >
              إنشاء المجموعة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
