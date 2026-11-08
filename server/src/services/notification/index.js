import { Notification } from '../../modules/notifications/notification.model.js';

// In-app notification for one user (shown in their bell).
export function notifyUser({ userId, title, message = '', link, relatedLoanId }) {
  return Notification.create({ userId, title, message, link, relatedLoanId });
}
