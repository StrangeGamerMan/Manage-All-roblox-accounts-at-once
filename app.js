const accountsTextarea = document.getElementById('accounts');
const commandInput = document.getElementById('commandInput');
const output = document.getElementById('output');

function runCommandForAllAccounts(command) {
    const lines = accountsTextarea.value.split('\n');
    lines.forEach((line) => {
        const [username, password] = line.split(':');
        if (!username || !password) return;

        // Only safe commands here
        if (command.toLowerCase().startsWith('follow ')) {
            const userToFollow = command.split(' ')[1];
            output.textContent += `${username} now follows ${userToFollow} (simulated)\n`;
        } else if (command.toLowerCase() === 'acceptfriends') {
            output.textContent += `${username} accepted all friend requests (simulated)\n`;
        } else if (command.toLowerCase().startsWith('join ')) {
            const placeId = command.split(' ')[1];
            output.textContent += `${username} joined place ${placeId} (simulated)\n`;
        } else {
            output.textContent += `Command "${command}" not recognized or unsafe.\n`;
        }
    });
}

document.getElementById('runCommand').addEventListener('click', () => {
    const cmd = commandInput.value.trim();
    if(cmd) runCommandForAllAccounts(cmd);
});
