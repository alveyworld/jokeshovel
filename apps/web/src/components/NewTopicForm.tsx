import { LIMITS } from '@jokeshovel/shared';
import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useMutations } from '../data/hooks';

export function NewTopicForm({ autoFocus }: { autoFocus?: boolean }) {
  const { createTopic } = useMutations();
  const navigate = useNavigate();
  const id = useId();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give your topic a name, like “Airports” or “My dentist”.');
      return;
    }
    const topicId = createTopic(title);
    setTitle('');
    navigate(`/topics/${topicId}/associations`);
  };

  return (
    <form className="inline-form" onSubmit={submit} noValidate>
      <label htmlFor={id} className="field__label">
        New topic
      </label>
      <div className="inline-form__row">
        <input
          id={id}
          type="text"
          value={title}
          maxLength={LIMITS.topicTitle}
          placeholder="e.g. Airports"
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className="btn btn--primary">
          Start digging
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
