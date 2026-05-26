'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface ProfileData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phones: string[];
}

interface ProfileFormProps {
  profile: ProfileData;
  accessToken: string;
}

type FeedbackState =
  | { type: 'idle' }
  | { type: 'saving' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export function ProfileForm({ profile, accessToken }: ProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [phone, setPhone] = useState(profile.phones[0] ?? '');
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'idle' });

  const handleCancel = useCallback(() => {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setPhone(profile.phones[0] ?? '');
    setIsEditing(false);
    setFeedback({ type: 'idle' });
  }, [profile.firstName, profile.lastName, profile.phones]);

  const handleSave = useCallback(async () => {
    setFeedback({ type: 'saving' });
    try {
      const res = await fetch(`${API}/users/${profile.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFeedback({
          type: 'error',
          message: json.message ?? 'Failed to update profile.',
        });
        return;
      }
      setFeedback({ type: 'success', message: 'Profile updated successfully.' });
      setIsEditing(false);
    } catch {
      setFeedback({ type: 'error', message: 'Network error. Please try again.' });
    }
  }, [profile.id, accessToken, firstName, lastName, phone]);

  const inputClass =
    'w-full border border-border bg-transparent px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none transition-colors';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium uppercase tracking-[0.1em] text-ink">Profile</h2>
        {!isEditing && (
          <button
            onClick={() => {
              setIsEditing(true);
              setFeedback({ type: 'idle' });
            }}
            className="text-xs font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-ink"
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* Feedback message */}
      {feedback.type === 'success' && (
        <div className="mb-4 border border-ink/20 bg-muted-bg px-4 py-3 text-sm text-ink">
          {feedback.message}
        </div>
      )}
      {feedback.type === 'error' && (
        <div className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {feedback.message}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* First Name */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
              First Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={cn(inputClass, 'mt-1')}
                placeholder="First name"
              />
            ) : (
              <p className="mt-1 text-sm text-ink">{firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
              Last Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={cn(inputClass, 'mt-1')}
                placeholder="Last name"
              />
            ) : (
              <p className="mt-1 text-sm text-ink">{lastName}</p>
            )}
          </div>
        </div>

        {/* Email (always read-only) */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            Email
          </label>
          <p className="mt-1 text-sm text-ink">{profile.email}</p>
          {isEditing && (
            <p className="mt-1 text-[11px] text-muted">Email cannot be changed.</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            Phone
          </label>
          {isEditing ? (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={cn(inputClass, 'mt-1')}
              placeholder="Phone number"
            />
          ) : (
            <p className="mt-1 text-sm text-ink">{phone || 'Not set'}</p>
          )}
          {(profile.phones?.length ?? 0) > 1 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.1em] text-muted hover:text-ink transition-colors">
                Previous numbers ({(profile.phones?.length ?? 1) - 1})
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
                {profile.phones?.slice(1).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Action buttons */}
        {isEditing && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={feedback.type === 'saving'}
              className={cn(
                'bg-ink px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-ink/90',
                feedback.type === 'saving' && 'cursor-wait opacity-70',
              )}
            >
              {feedback.type === 'saving' ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={feedback.type === 'saving'}
              className="px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.15em] text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
