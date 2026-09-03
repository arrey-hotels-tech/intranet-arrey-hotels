'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { archiveDemand, deleteDemand, updateDemandStatus } from '@/app/actions/painelActions';
import { confirmUploads } from '@/app/actions/mediaActions';
import {
  acceptTaskInvitation,
  archiveInternalTask,
  createInternalTask,
  deleteInternalTask,
  updateInternalTaskStatus,
} from '@/app/actions/taskActions';

const COLUMNS = [
  ['novo', 'Novo'],
  ['em_andamento', 'Em andamento'],
  ['aguardando', 'Aguardando'],
  ['concluido', 'Concluído'],
];

function LinkifiedText({ text }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/gi);
  return parts.map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return <span key={index}>{part}</span>;
    const trailingPunctuation = part.match(/[.,;:!?)]*$/)?.[0] || '';
    const url = trailingPunctuation ? part.slice(0, -trailingPunctuation.length) : part;
    return (
      <span key={index}>
        <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
        {trailingPunctuation}
      </span>
    );
  });
}

export default function KanbanBoard({ initialItems, people, role }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [dragKey, setDragKey] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actingKey, setActingKey] = useState(null);

  useEffect(() => setItems(initialItems), [initialItems]);

  async function refreshBoard() {
    router.refresh();
  }

  async function handleCreate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = [...(form.querySelector('[data-task-attachments]')?.files || [])];
    setSaving(true);
    setErrorMsg('');
    const formData = new FormData(form);
    formData.set('attachments', JSON.stringify(files.map((file) => ({ name: file.name, type: file.type, size: file.size }))));
    const result = await createInternalTask(formData);
    if (result.error) {
      setSaving(false);
      return setErrorMsg(result.error);
    }
    try {
      await Promise.all((result.uploads || []).map(async (upload, index) => {
        const response = await fetch(upload.url, {
          method: 'PUT',
          headers: { 'Content-Type': upload.contentType },
          body: files[index],
        });
        if (!response.ok) throw new Error('Falha no upload');
      }));
      const confirmation = await confirmUploads((result.uploads || []).map(({ id, token }) => ({ id, token })));
      if (confirmation.error) throw new Error(confirmation.error);
    } catch {
      setSaving(false);
      setErrorMsg(`A tarefa #T${result.id} foi criada, mas um anexo não foi enviado. Avise a equipe de tecnologia.`);
      refreshBoard();
      return;
    }
    setSaving(false);
    form.reset();
    setShowForm(false);
    refreshBoard();
  }

  async function onDrop(status) {
    if (!dragKey) return;
    setDragOverCol(null);
    const item = items.find((candidate) => candidate.boardKey === dragKey);
    if (!item?.canEdit) return setDragKey(null);

    const previous = items;
    setItems((current) => current.map((candidate) => candidate.boardKey === dragKey ? { ...candidate, status } : candidate));
    const result = item.kind === 'task'
      ? await updateInternalTaskStatus(item.id, status)
      : await updateDemandStatus(item.id, status);
    if (result.error) {
      setErrorMsg(result.error);
      setItems(previous);
    } else {
      setErrorMsg('');
    }
    setDragKey(null);
  }

  async function acceptInvitation(participantId) {
    const result = await acceptTaskInvitation(participantId);
    if (result.error) return setErrorMsg(result.error);
    setErrorMsg('');
    refreshBoard();
  }

  async function handleActionSelect(item, event) {
    const action = event.currentTarget.value;
    event.currentTarget.value = '';
    if (!action) return;
    if (action === 'accept') return acceptInvitation(item.pendingInvitationId);
    return performCardAction(item, action);
  }

  async function performCardAction(item, action) {
    if (action === 'delete' && !window.confirm(`Excluir definitivamente “${item.title}”? Esta ação não pode ser desfeita.`)) return;
    setActingKey(item.boardKey);
    setErrorMsg('');

    let result;
    if (action === 'finish') {
      result = item.kind === 'task'
        ? await updateInternalTaskStatus(item.id, 'concluido')
        : await updateDemandStatus(item.id, 'concluido');
    } else if (action === 'archive') {
      result = item.kind === 'task' ? await archiveInternalTask(item.id) : await archiveDemand(item.id);
    } else {
      result = item.kind === 'task' ? await deleteInternalTask(item.id) : await deleteDemand(item.id);
    }

    setActingKey(null);
    if (result.error) return setErrorMsg(result.error);
    if (action === 'archive' || action === 'delete') {
      setItems((current) => current.filter((candidate) => candidate.boardKey !== item.boardKey));
    } else {
      setItems((current) => current.map((candidate) => candidate.boardKey === item.boardKey ? { ...candidate, status: 'concluido' } : candidate));
    }
    refreshBoard();
  }

  const assignablePeople = people.filter((person) => person.canAssign);
  const executors = people.filter((person) => person.canExecute);
  const followers = people.filter((person) => person.canFollow);

  return (
    <div>
      <div className="kanban-toolbar">
        <button className="btn small" onClick={() => setShowForm((visible) => !visible)}>
          {showForm ? 'Cancelar' : '+ Nova tarefa'}
        </button>
      </div>

      {showForm && (
        <form className="card task-form" onSubmit={handleCreate}>
          <div className="field"><label>Título</label><input name="title" type="text" required /></div>
          <div className="field"><label>Descrição</label><textarea name="description" /></div>
          <div className="task-form-grid">
            <div className="field">
              <label>Responsável principal</label>
              <select name="assignee">
                <option value="self">Eu mesmo</option>
                {assignablePeople.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.role})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Prioridade</label>
              <select name="priority" defaultValue="media">
                <option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option>
              </select>
            </div>
            <div className="field"><label>Prazo (opcional)</label><input name="dueDate" type="date" /></div>
          </div>
          {executors.length > 0 && (
            <div className="field">
              <label>Executores adicionais (opcional)</label>
              <select name="executors" multiple size={Math.min(4, executors.length)}>
                {executors.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.role})</option>)}
              </select>
            </div>
          )}
          {followers.length > 0 && (
            <div className="field">
              <label>Acompanhamento solicitado (opcional)</label>
              <select name="followers" multiple size={Math.min(4, followers.length)}>
                {followers.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.role})</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Fotos, vídeos ou PDF (opcional, até 5 arquivos)</label>
            <input data-task-attachments type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,video/mp4,video/quicktime,video/webm" />
            <p className="form-help">Fotos/PDF até 15 MB; vídeos até 100 MB; total máximo de 200 MB.</p>
          </div>
          <p className="form-help">Use Ctrl (Windows) ou Command (Mac) para selecionar mais de uma pessoa.</p>
          {errorMsg && <p className="error-text">{errorMsg}</p>}
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Criando…' : 'Criar tarefa'}</button>
        </form>
      )}

      {!showForm && errorMsg && <p className="error-text">{errorMsg}</p>}
      <div className="kanban">
        {COLUMNS.map(([status, label]) => {
          const columnItems = items.filter((item) => item.status === status);
          return (
            <div
              key={status}
              className={`kcol${dragOverCol === status ? ' dragover' : ''}`}
              onDragOver={(event) => { if (dragKey) { event.preventDefault(); setDragOverCol(status); } }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => onDrop(status)}
            >
              <h4>{label} <span>{columnItems.length}</span></h4>
              {columnItems.map((item) => (
                <div
                  key={item.boardKey}
                  className="kcard"
                  data-prio={item.priority}
                  draggable={item.canEdit}
                  onDragStart={() => item.canEdit && setDragKey(item.boardKey)}
                  onDragEnd={() => { setDragKey(null); setDragOverCol(null); }}
                >
                  <div className="k-source">{item.sourceLabel}</div>
                  <div className="k-title">#{item.kind === 'task' ? 'T' : 'D'}{item.id} {item.title}</div>
                  <div className="k-meta">{item.primaryName} · {item.secondaryName}</div>
                  {item.kind === 'task' && item.description && <div className="k-description"><LinkifiedText text={item.description} /></div>}
                  {item.kind === 'task' && item.participants?.length > 0 && (
                    <div className="k-meta">Participantes: {item.participants.map((participant) => participant.name).join(', ')}</div>
                  )}
                  {item.attachments?.length > 0 && (
                    <div className="attachment-list">
                      {item.attachments.map((attachment) => (
                        <a key={attachment.id} className="attachment-link" href={attachment.url} target="_blank" rel="noopener noreferrer">
                          {attachment.name}
                        </a>
                      ))}
                    </div>
                  )}
                  {(item.pendingInvitationId || item.canEdit || item.canArchive || item.canDelete) && (
                    <select
                      className="k-action-box"
                      defaultValue=""
                      disabled={actingKey === item.boardKey}
                      aria-label={`Ações para ${item.title}`}
                      onMouseDown={(event) => event.stopPropagation()}
                      onChange={(event) => handleActionSelect(item, event)}
                    >
                      <option value="" disabled>{actingKey === item.boardKey ? 'Processando…' : 'Ações…'}</option>
                      {item.pendingInvitationId && (
                        <option value="accept">Aceitar {item.pendingInvitationRole === 'executor' ? 'execução' : 'acompanhamento'}</option>
                      )}
                      {item.canEdit && item.status !== 'concluido' && <option value="finish">Finalizar</option>}
                      {item.canArchive && <option value="archive">Arquivar</option>}
                      {item.canDelete && <option value="delete">Excluir definitivamente</option>}
                    </select>
                  )}
                </div>
              ))}
              {columnItems.length === 0 && <div className="empty-column">Sem itens</div>}
            </div>
          );
        })}
      </div>
      {role === 'gestor' && <p className="panel-hint">Você vê suas tarefas, tarefas recebidas e convites de acompanhamento.</p>}
    </div>
  );
}
