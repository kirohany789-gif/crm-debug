import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
apiKey: 'YOUR_REAL_API_KEY',
authDomain: 'crm-app-c9a37.firebaseapp.com',
projectId: 'crm-app-c9a37',
storageBucket: 'crm-app-c9a37.firebasestorage.app',
messagingSenderId: '482214559683',
appId: '1:482214559683:web:588e13edfd5b0718744776',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');