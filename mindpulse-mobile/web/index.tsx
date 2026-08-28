import { AppRegistry } from 'react-native';
import { createRoot } from 'react-dom/client';
import App from '../App';
import { name as appName } from '../app.json';

const root = createRoot(document.getElementById('root') as HTMLElement);

AppRegistry.registerComponent(appName, () => App);
root.render(<App />);