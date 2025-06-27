// cancel-group-modal.js
// Simple modal dialog for confirming group cancellation

export function showCancelGroupModal(group, onConfirm, onCancel) {
    let modal = document.getElementById('cancel-group-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cancel-group-modal';
        modal.className = 'modal show-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <h3>Cancel Group</h3>
                <p>Are you sure you want to cancel group <strong>${group.groupNumber || group.group_number || group.id}</strong>?<br>
                This will revert all orders to pending and remove them from the group, or delete the group if empty.</p>
                <div style="margin-top: 2em;">
                    <button class="btn btn-danger" id="confirm-cancel-group">Yes, Cancel Group</button>
                    <button class="btn btn-secondary" id="cancel-cancel-group">No, Keep Group</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = '';
    }
    modal.classList.remove('hidden');

    // Remove any previous listeners
    const newConfirm = modal.querySelector('#confirm-cancel-group').cloneNode(true);
    const newCancel = modal.querySelector('#cancel-cancel-group').cloneNode(true);
    modal.querySelector('#confirm-cancel-group').replaceWith(newConfirm);
    modal.querySelector('#cancel-cancel-group').replaceWith(newCancel);

    newConfirm.onclick = () => {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        if (typeof onConfirm === 'function') onConfirm();
    };
    newCancel.onclick = () => {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        if (typeof onCancel === 'function') onCancel();
    };
}
