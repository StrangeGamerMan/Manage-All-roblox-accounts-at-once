const accountsTextarea = document.getElementById('accounts');
const output = document.getElementById('output');

document.getElementById('loginAll').addEventListener('click', () => {
  const lines = accountsTextarea.value.split('\n');
  output.textContent = '';
  lines.forEach((line, i) => {
    const [username, password] = line.split(':');
    if(username && password){
      output.textContent += `Logged in account ${username}\n`;
      // In a real safe setup, here you would initiate Roblox login in a browser session
    }
  });
});

document.getElementById('acceptAllFriends').addEventListener('click', () => {
  output.textContent += 'Accepted all friend requests for all accounts (simulated)\n';
});

document.getElementById('followUser').addEventListener('click', () => {
  const user = document.getElementById('followUsername').value;
  output.textContent += `All accounts now follow ${user} (simulated)\n`;
});
