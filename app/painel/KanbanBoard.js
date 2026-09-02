'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateDemandStatus } from '@/app/actions/painelActions';
import { acceptTaskInvitation, createInternalTask, updateInternalTaskStatus } from '@/app/actions/taskActions';

const COLUMNS = [
  ['novo', 'Novo'],
  ['em_andamento', 'Em andamento'],
  ['aguardando', 'Aguardando'],
  ['concluido', 'Concluído'],
];

export default function KanbanBoard({ initialItems, people, role }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [dragKey, setDragKey] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setItems(initialItems), [initialItems]);

  async function refreshBoard() {
    router.refresh();
  }

  async function handleCreate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setErrorMsg('');
    const result = await createInternalTask(new FormData(form));
    setSaving(false);
    if (result.error) return setErrorMsg(result.error);
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
                  {item.kind === 'task' && item.description && <div className="k-description">{item.description}</div>}
                  {item.kind === 'task' && item.participants?.length > 0 && (
                    <div className="k-meta">Participantes: {item.participants.map((participant) => participant.name).join(', ')}</div>
                  )}
                  {item.pendingInvitationId && (
                    <button className="btn ghost small invite-button" onClick={() => acceptInvitation(item.pendingInvitationId)}>
                      Aceitar {item.pendingInvitationRole === 'executor' ? 'execução' : 'acompanhamento'}
                    </button>
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
