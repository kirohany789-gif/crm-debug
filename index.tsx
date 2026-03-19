import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_SETTINGS_STORAGE_KEY } from './settings';

import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as SMS from 'expo-sms';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db, functions } from '../../firebase';

type ServiceCategory = '' | 'automotive' | 'residential' | 'commercial';

type JobStatus =
  | 'called'
  | 'awaiting_confirmation'
  | 'booked_confirmed'
  | 'finished_unpaid'
  | 'completed_paid';

type RollWidth = '' | '36' | '48' | '60' | '72';

type WindowLineItem = {
  id: string;
  productNameInput: string;
  matchedProductKey: string | null;
  rollWidth: RollWidth;
  rollLengthFeet: string;
  windowWidthInches: string;
  windowHeightInches: string;
  squareFeet: number;
  materialCost: number;
};

type Job = {
  id: string;
  createdAt: string;

  serviceCategory: ServiceCategory;
  serviceWanted: string;
  filmPackage: string;

  quoteAmount: string;
  leadSource: string;
  notes: string;
  isPaid: boolean;
  status: JobStatus;

  paymentLinkSentAt: string | null;
  paidInCashAt: string | null;
  reviewRequestedAt: string | null;

  appointmentAt: string | null;
  finishedAt: string | null;

  beforePhotoUri: string | null;
  afterPhotoUri: string | null;
  beforeVideoUri: string | null;
  afterVideoUri: string | null;

  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;

  glassType: string;
  filmType: string;
  squareFeet: string;

  aiEstimatedSqFt: number | null;
  materialCost: number | null;

  productNameInput: string;
  matchedProductKey: string | null;
  rollWidth: RollWidth;
  rollLengthFeet: string;

  windowLineItems: WindowLineItem[];
  totalWindowSqFt: number;
};

type Customer = {
  id: string;
  number: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  createdAt: string;
  lastCalledAt: string | null;
  reviewLinkSentEver: boolean;
  jobs: Job[];
};

type FilmPriceBook = Record<
  string,
  Partial<Record<Exclude<RollWidth, ''>, number | null>>
>;

type AppSettings = {
  paymentLink?: string;
  zellePayTo?: string;
  businessPhone?: string;
  googleReviewLink?: string;
};

const STORAGE_KEY = 'crm_clean_full_reset_v10_ai_monthly_materials';

const DEFAULT_PAYMENT_LINK = 'https://your-payment-link-here.com';
const DEFAULT_ZELLE_PAY_TO = '480-487-6235';
const DEFAULT_BUSINESS_PHONE = '623-890-2867';
const DEFAULT_GOOGLE_REVIEW_LINK = 'https://g.page/r/CThDGB_Nc48BEBM/review';

const AUTOMOTIVE_SERVICES = [
  'Full vehicle',
  'Front 2 windows',
  'Windshield',
  'Sunroof',
  'Brow',
  'Remove old tint',
  'Other',
];

const RESIDENTIAL_SERVICES = [
  'Whole home',
  'Living room windows',
  'Bedroom windows',
  'Sliding door',
  'Skylight',
  'Patio doors',
  'Other',
];

const COMMERCIAL_SERVICES = [
  'Storefront',
  'Office windows',
  'Entry doors',
  'Conference room glass',
  'Full building',
  'Lobby glass',
  'Other',
];

const FILM_PACKAGES = [
  'Nano Ceramic Package',
  'Ceramic Package',
  'Carbon Package',
  'Other',
];

const GLASS_TYPES = [
  'Single pane',
  'Double pane',
  'Tempered',
  'Laminated',
  'Storefront glass',
  'Other',
];

const ROLL_WIDTH_OPTIONS: RollWidth[] = ['', '36', '48', '60', '72'];
const PRICE_INCREASE = 1.07;

const FILM_PRICE_BOOK_100FT: FilmPriceBook = {
  'Max Night Vista 20% PS': { '36': 299.0, '48': null, '60': 459.0, '72': 552.0 },
  'Max Night Vista 35% PS': { '36': null, '48': null, '60': 459.0, '72': null },
  'Elite Max 35% PS': { '36': 576.0, '48': 796.0, '60': 920.0, '72': 1106.0 },
  'Elite Max 50% PS': { '36': 488.0, '48': 676.0, '60': 770.0, '72': 922.0 },
  'Elite Max 70% PS': { '36': 461.0, '48': 650.0, '60': 733.0, '72': 878.0 },
  'Max Neutral 20% DA': { '36': 294.0, '48': 426.0, '60': 456.0, '72': 543.0 },
  'Max Neutral 35% DA': { '36': 294.0, '48': 426.0, '60': 456.0, '72': 543.0 },
  'Max Neutral 55% DA': { '36': 286.0, '48': 408.0, '60': 436.0, '72': 524.0 },
  'Max Solar Bronze 20% DA': { '36': 380.0, '48': 524.0, '60': 576.0, '72': 688.0 },
  'Max Solar Bronze 35% DA': { '36': 349.0, '48': 499.0, '60': 549.0, '72': 658.0 },

  'Max Dual Reflective 5% DA': { '36': 272.0, '48': 399.0, '60': 417.0, '72': 504.0 },
  'Max Dual Reflective 15% DA': { '36': 272.0, '48': 399.0, '60': 417.0, '72': 504.0 },
  'Max Dual Reflective 25% DA': { '36': 272.0, '48': 399.0, '60': 417.0, '72': 504.0 },
  'Max Dual Reflective 35% DA': { '36': 272.0, '48': 399.0, '60': 417.0, '72': 504.0 },
  'Max Dual Reflective 45% DA': { '36': 272.0, '48': 399.0, '60': 417.0, '72': 504.0 },

  'Max Silver 20% DA': { '36': 229.0, '48': 335.0, '60': 343.0, '72': 411.0 },
  'Max Silver 30% DA': { '36': 229.0, '48': 343.0, '60': 355.0, '72': 426.0 },
  'Max Silver 40% DA': { '36': 229.0, '48': 343.0, '60': 355.0, '72': 426.0 },

  'Exterior Clear Max 7 Mil PS': { '36': null, '48': null, '60': 1110.0, '72': 1331.0 },
  'Exterior Max Solar Grey 20% 2 Mil PS': { '36': null, '48': null, '60': 1393.0, '72': 1670.0 },
  'Exterior Max Soft Bronze 20% 2 Mil PS': { '36': null, '48': null, '60': 1393.0, '72': 1670.0 },
  'Exterior Max Soft Bronze 35% 2 Mil PS': { '36': null, '48': null, '60': 1393.0, '72': 1670.0 },
  'Exterior Max Silver 20% 2 Mil PS': { '36': null, '48': null, '60': 772.0, '72': 926.0 },

  'White Max 2 Mil PS': { '36': null, '48': null, '60': 335.0, '72': null },
  'Black Max 3 Mil PS': { '36': null, '48': null, '60': 399.0, '72': null },
  'White Frost Matte 2 Mil PS': { '36': 229.0, '48': 363.0, '60': 399.0, '72': 480.0 },

  // Automotive hardcoded options
  'Nano Ceramic Package': { '60': 540.0 },
  'Ceramic Package': { '60': 430.0 },
  'Carbon Package': { '60': 320.0 },
};

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      contentFit="contain"
    />
  );
}

const round2 = (value: number) => Number(value.toFixed(2));

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[%"]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const createBlankWindowLineItem = (): WindowLineItem => ({
  id: `window_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  productNameInput: '',
  matchedProductKey: null,
  rollWidth: '',
  rollLengthFeet: '100',
  windowWidthInches: '',
  windowHeightInches: '',
  squareFeet: 0,
  materialCost: 0,
});

const getRollSqFt = (rollWidth: RollWidth, rollLengthFeet: number) => {
  const widthInches = Number(rollWidth);
  if (!widthInches || !rollLengthFeet) return 0;
  return round2((widthInches / 12) * rollLengthFeet);
};

const getUpdatedRollPrice = (basePrice: number) => round2(basePrice * PRICE_INCREASE);

const findClosestFilmProduct = (input: string): string | null => {
  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return null;

  const keys = Object.keys(FILM_PRICE_BOOK_100FT);
  if (keys.some((k) => normalizeText(k) === normalizedInput)) {
    return keys.find((k) => normalizeText(k) === normalizedInput) || null;
  }

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const key of keys) {
    const normalizedKey = normalizeText(key);
    let score = 0;

    if (normalizedKey.includes(normalizedInput) || normalizedInput.includes(normalizedKey)) {
      score += 4;
    }

    const inputWords = normalizedInput.split(' ');
    const keyWords = normalizedKey.split(' ');
    for (const word of inputWords) {
      if (keyWords.includes(word)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  }

  return bestScore > 0 ? bestMatch : null;
};

const calculateWindowLineItem = (item: WindowLineItem): WindowLineItem => {
  const matchedProductKey = findClosestFilmProduct(item.productNameInput);
  const rollWidth = item.rollWidth;
  const rollLengthFeet = Number(item.rollLengthFeet);
  const windowWidthInches = Number(item.windowWidthInches);
  const windowHeightInches = Number(item.windowHeightInches);

  const squareFeet =
    windowWidthInches > 0 && windowHeightInches > 0
      ? round2((windowWidthInches * windowHeightInches) / 144)
      : 0;

  if (!matchedProductKey || !rollWidth) {
    return {
      ...item,
      matchedProductKey,
      squareFeet,
      materialCost: 0,
    };
  }

  const basePrice =
    FILM_PRICE_BOOK_100FT[matchedProductKey]?.[rollWidth as Exclude<RollWidth, ''>];

  if (!basePrice || rollLengthFeet <= 0) {
    return {
      ...item,
      matchedProductKey,
      squareFeet,
      materialCost: 0,
    };
  }

  const updated100FtPrice = getUpdatedRollPrice(basePrice);
  const effectiveRollPrice = round2((updated100FtPrice * rollLengthFeet) / 100);
  const effectiveRollSqFt = getRollSqFt(rollWidth, rollLengthFeet);
  const costPerSqFt = effectiveRollSqFt > 0 ? effectiveRollPrice / effectiveRollSqFt : 0;
  const materialCost = round2(costPerSqFt * squareFeet);

  return {
    ...item,
    matchedProductKey,
    squareFeet,
    materialCost,
  };
};

const getWindowTotals = (items: WindowLineItem[]) => {
  const safeItems = items.map(calculateWindowLineItem);
  const totalWindowSqFt = round2(
    safeItems.reduce((sum, item) => sum + item.squareFeet, 0)
  );
  const totalMaterialCost = round2(
    safeItems.reduce((sum, item) => sum + item.materialCost, 0)
  );

  return {
    safeItems,
    totalWindowSqFt,
    totalMaterialCost,
  };
};

export default function HomeScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [screen, setScreen] = useState<'main' | 'finish'>('main');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<string[]>([]);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>('');
  const [serviceWanted, setServiceWanted] = useState('');
  const [filmPackage, setFilmPackage] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [notes, setNotes] = useState('');
  const [isPaid, setIsPaid] = useState(false);

  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  const [glassType, setGlassType] = useState('');
  const [filmType, setFilmType] = useState('');
  const [squareFeet, setSquareFeet] = useState('');

  const [productNameInput, setProductNameInput] = useState('');
  const [rollWidth, setRollWidth] = useState<RollWidth>('');
  const [rollLengthFeet, setRollLengthFeet] = useState('100');
  const [windowLineItems, setWindowLineItems] = useState<WindowLineItem[]>([
    createBlankWindowLineItem(),
  ]);

  const [customServiceWanted, setCustomServiceWanted] = useState('');
  const [customFilmPackage, setCustomFilmPackage] = useState('');
  const [customGlassType, setCustomGlassType] = useState('');

  const [appointmentEnabled, setAppointmentEnabled] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState<string | null>(null);
  const [draftAppointmentDate, setDraftAppointmentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [finishCustomerId, setFinishCustomerId] = useState<string | null>(null);
  const [finishJobId, setFinishJobId] = useState<string | null>(null);
  const [finishBeforePhotoUri, setFinishBeforePhotoUri] = useState<string | null>(null);
  const [finishAfterPhotoUri, setFinishAfterPhotoUri] = useState<string | null>(null);
  const [finishBeforeVideoUri, setFinishBeforeVideoUri] = useState<string | null>(null);
  const [finishAfterVideoUri, setFinishAfterVideoUri] = useState<string | null>(null);

  const [isEstimatingAI, setIsEstimatingAI] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isFinishingJob, setIsFinishingJob] = useState(false);

  const [appPaymentLink, setAppPaymentLink] = useState(DEFAULT_PAYMENT_LINK);
  const [appZellePayTo, setAppZellePayTo] = useState(DEFAULT_ZELLE_PAY_TO);
  const [appBusinessPhone, setAppBusinessPhone] = useState(DEFAULT_BUSINESS_PHONE);
  const [appGoogleReviewLink, setAppGoogleReviewLink] = useState(
    DEFAULT_GOOGLE_REVIEW_LINK
  );

  async function loadAppSettings() {
    try {
      const raw = await AsyncStorage.getItem(APP_SETTINGS_STORAGE_KEY);
      if (!raw) return;

      const parsed: AppSettings = JSON.parse(raw);

      if (parsed.paymentLink) setAppPaymentLink(parsed.paymentLink);
      if (parsed.zellePayTo) setAppZellePayTo(parsed.zellePayTo);
      if (parsed.businessPhone) setAppBusinessPhone(parsed.businessPhone);
      if (parsed.googleReviewLink) setAppGoogleReviewLink(parsed.googleReviewLink);
    } catch (error) {
      console.log('Failed to load app settings:', error);
    }
  }

  useEffect(() => {
    loadCustomers();
    requestPermissions();
  }, []);

  useEffect(() => {
    if (!hasLoadedData) return;
    saveCustomersLocal(customers);
    syncCustomersToFirebase(customers);
  }, [customers, hasLoadedData]);

  useEffect(() => {
    loadAppSettings();
  }, []);

  const requestPermissions = async () => {
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
    } catch (error) {
      console.log('Permission error:', error);
    }
  };

  const normalizeJob = (job: Partial<Job>, fallbackId: string): Job => ({
    id: job.id || fallbackId,
    createdAt: job.createdAt || new Date().toISOString(),
    serviceCategory: (job.serviceCategory as ServiceCategory) || '',
    serviceWanted: job.serviceWanted || '',
    filmPackage: job.filmPackage || '',
    quoteAmount: job.quoteAmount || '',
    leadSource: job.leadSource || '',
    notes: job.notes || '',
    isPaid: !!job.isPaid,
    status: (job.status as JobStatus) || 'called',
    paymentLinkSentAt: job.paymentLinkSentAt || null,
    paidInCashAt: job.paidInCashAt || null,
    reviewRequestedAt: job.reviewRequestedAt || null,
    appointmentAt: job.appointmentAt || null,
    finishedAt: job.finishedAt || null,
    beforePhotoUri: job.beforePhotoUri || null,
    afterPhotoUri: job.afterPhotoUri || null,
    beforeVideoUri: job.beforeVideoUri || null,
    afterVideoUri: job.afterVideoUri || null,
    vehicleYear: job.vehicleYear || '',
    vehicleMake: job.vehicleMake || '',
    vehicleModel: job.vehicleModel || '',
    glassType: job.glassType || '',
    filmType: job.filmType || '',
    squareFeet: job.squareFeet || '',
    aiEstimatedSqFt:
      typeof job.aiEstimatedSqFt === 'number' ? job.aiEstimatedSqFt : null,
    materialCost:
      typeof job.materialCost === 'number' ? job.materialCost : null,
    productNameInput: job.productNameInput || '',
    matchedProductKey: job.matchedProductKey || null,
    rollWidth: (job.rollWidth as RollWidth) || '',
    rollLengthFeet: job.rollLengthFeet || '100',
    windowLineItems: Array.isArray(job.windowLineItems)
      ? job.windowLineItems.map((item, index) =>
          calculateWindowLineItem({
            id: item.id || `${fallbackId}_window_${index}`,
            productNameInput: item.productNameInput || '',
            matchedProductKey: item.matchedProductKey || null,
            rollWidth: (item.rollWidth as RollWidth) || '',
            rollLengthFeet: item.rollLengthFeet || '100',
            windowWidthInches: item.windowWidthInches || '',
            windowHeightInches: item.windowHeightInches || '',
            squareFeet: typeof item.squareFeet === 'number' ? item.squareFeet : 0,
            materialCost:
              typeof item.materialCost === 'number' ? item.materialCost : 0,
          })
        )
      : [],
    totalWindowSqFt:
      typeof job.totalWindowSqFt === 'number' ? job.totalWindowSqFt : 0,
  });

  const saveCustomersLocal = async (nextCustomers: Customer[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextCustomers));
    } catch (error) {
      console.log('Local save failed:', error);
    }
  };

  const syncCustomersToFirebase = async (nextCustomers: Customer[]) => {
    try {
      for (const customer of nextCustomers) {
        await setDoc(doc(db, 'customers', customer.id), customer);
      }
    } catch (error) {
      console.log('Firebase sync failed:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'customers'));

      const firebaseCustomers = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Partial<Customer>;

        return {
          id: data.id || docSnap.id,
          number: typeof data.number === 'number' ? data.number : 0,
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          createdAt: data.createdAt || new Date().toISOString(),
          lastCalledAt: data.lastCalledAt || null,
          reviewLinkSentEver: !!data.reviewLinkSentEver,
          jobs: Array.isArray(data.jobs)
            ? data.jobs.map((job, index) =>
                normalizeJob(job, `job_loaded_${docSnap.id}_${index}`)
              )
            : [],
        } as Customer;
      });

      if (firebaseCustomers.length > 0) {
        const sorted = firebaseCustomers.sort((a, b) => b.number - a.number);
        setCustomers(sorted);
        await saveCustomersLocal(sorted);
        setHasLoadedData(true);
        return;
      }
    } catch (error) {
      console.log('Firebase load failed, falling back to local:', error);
    }

    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Customer[];
        const safeParsed = parsed.map((customer, customerIndex) => ({
          ...customer,
          reviewLinkSentEver: !!customer.reviewLinkSentEver,
          jobs: Array.isArray(customer.jobs)
            ? customer.jobs.map((job, jobIndex) =>
                normalizeJob(job, `job_local_${customerIndex}_${jobIndex}`)
              )
            : [],
        }));
        setCustomers(safeParsed);
      }
    } catch (error) {
      console.log('Local load failed:', error);
    } finally {
      setHasLoadedData(true);
    }
  };

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 10);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  const formatMoneyInput = (text: string) => text.replace(/[^0-9.]/g, '');

  const isValidEmail = (value: string) => {
    if (!value.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const parseAmount = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getNextCustomerNumber = () => {
    const validNumbers = customers
      .map((c) => c.number)
      .filter((n) => typeof n === 'number' && !Number.isNaN(n));

    if (validNumbers.length === 0) return 1;
    return Math.max(...validNumbers) + 1;
  };

  const getServiceOptions = () => {
    switch (serviceCategory) {
      case 'automotive':
        return AUTOMOTIVE_SERVICES;
      case 'residential':
        return RESIDENTIAL_SERVICES;
      case 'commercial':
        return COMMERCIAL_SERVICES;
      default:
        return [];
    }
  };

  const buildVehicleLabel = (job: Job) => {
    return [job.vehicleYear, job.vehicleMake, job.vehicleModel]
      .map((x) => x.trim())
      .filter(Boolean)
      .join(' ');
  };

  const buildScopeLabel = (job: Job) => {
    if (job.serviceCategory === 'automotive') {
      return buildVehicleLabel(job) || 'No vehicle details';
    }

    if (job.windowLineItems.length > 0) {
      return `${job.windowLineItems.length} window${
        job.windowLineItems.length > 1 ? 's' : ''
      }`;
    }

    return (
      [
        job.glassType,
        job.filmType,
        job.squareFeet ? `${job.squareFeet} sq ft` : '',
      ]
        .filter(Boolean)
        .join(' • ') || 'No project details'
    );
  };

  const getLatestJob = (customer: Customer) => {
    if (!customer.jobs.length) return null;
    return [...customer.jobs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  };

  const toggleCustomerExpanded = (customerId: string) => {
    setExpandedCustomerIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');

    setServiceCategory('');
    setServiceWanted('');
    setFilmPackage('');
    setQuoteAmount('');
    setLeadSource('');
    setNotes('');
    setIsPaid(false);

    setVehicleYear('');
    setVehicleMake('');
    setVehicleModel('');

    setGlassType('');
    setFilmType('');
    setSquareFeet('');

    setProductNameInput('');
    setRollWidth('');
    setRollLengthFeet('100');
    setWindowLineItems([createBlankWindowLineItem()]);

    setCustomServiceWanted('');
    setCustomFilmPackage('');
    setCustomGlassType('');

    setEditingCustomerId(null);
    setEditingJobId(null);

    setAppointmentEnabled(false);
    setAppointmentDate(null);
    setDraftAppointmentDate(new Date());
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const resetFinishScreen = () => {
    setFinishCustomerId(null);
    setFinishJobId(null);
    setFinishBeforePhotoUri(null);
    setFinishAfterPhotoUri(null);
    setFinishBeforeVideoUri(null);
    setFinishAfterVideoUri(null);
    setIsEstimatingAI(false);
    setIsFinishingJob(false);
  };

  const pickPhoto = async (
    setter: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setter(result.assets[0].uri);
    }
  };

  const pickVideo = async (
    setter: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setter(result.assets[0].uri);
    }
  };

  const estimateTintWithAI = async (job: Job) => {
    try {
      const estimateTintJob = httpsCallable(functions, 'estimateTintJob');

      const result = await estimateTintJob({
        make: job.vehicleMake,
        model: job.vehicleModel,
        year: job.vehicleYear,
        serviceWanted: job.serviceWanted,
      });

      return (result.data as { estimatedSqFt?: number })?.estimatedSqFt || 0;
    } catch (error) {
      console.log('AI estimate failed:', error);
      return 0;
    }
  };

  const getAutomotiveMaterialCost = (
    productInput: string,
    selectedRollWidth: RollWidth,
    selectedRollLengthFeet: string,
    estimatedSqFt: number
  ) => {
    const matchedProductKey = findClosestFilmProduct(productInput);
    if (!matchedProductKey || !selectedRollWidth || estimatedSqFt <= 0) {
      return {
        matchedProductKey,
        materialCost: 0,
      };
    }

    const basePrice =
      FILM_PRICE_BOOK_100FT[matchedProductKey]?.[
        selectedRollWidth as Exclude<RollWidth, ''>
      ];

    const rollLengthFeet = Number(selectedRollLengthFeet);

    if (!basePrice || rollLengthFeet <= 0) {
      return {
        matchedProductKey,
        materialCost: 0,
      };
    }

    const updated100FtPrice = getUpdatedRollPrice(basePrice);
    const effectiveRollPrice = round2((updated100FtPrice * rollLengthFeet) / 100);
    const effectiveRollSqFt = getRollSqFt(selectedRollWidth, rollLengthFeet);
    const costPerSqFt =
      effectiveRollSqFt > 0 ? effectiveRollPrice / effectiveRollSqFt : 0;

    return {
      matchedProductKey,
      materialCost: round2(costPerSqFt * estimatedSqFt),
    };
  };

  const updateJobAIEstimate = async (
    customerId: string,
    jobId: string,
    estimate: number,
    materialCost: number,
    matchedProductKey: string | null
  ) => {
    setCustomers((prev) =>
      prev.map((customer) =>
        customer.id === customerId
          ? {
              ...customer,
              jobs: customer.jobs.map((job) =>
                job.id === jobId
                  ? {
                      ...job,
                      aiEstimatedSqFt: estimate,
                      materialCost,
                      matchedProductKey,
                    }
                  : job
              ),
            }
          : customer
      )
    );
  };

  const updateWindowLineItem = (
    lineItemId: string,
    field: keyof WindowLineItem,
    value: string
  ) => {
    setWindowLineItems((prev) =>
      prev.map((item) =>
        item.id === lineItemId
          ? calculateWindowLineItem({
              ...item,
              [field]: value,
            })
          : item
      )
    );
  };

  const addWindowLineItem = () => {
    setWindowLineItems((prev) => [...prev, createBlankWindowLineItem()]);
  };

  const removeWindowLineItem = (lineItemId: string) => {
    setWindowLineItems((prev) => {
      const next = prev.filter((item) => item.id !== lineItemId);
      return next.length > 0 ? next : [createBlankWindowLineItem()];
    });
  };

  const handleSaveCustomer = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a customer name.');
      return;
    }

    if (!phone.trim()) {
      Alert.alert('Missing phone', 'Please enter a phone number.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email or leave it blank.');
      return;
    }

    if (!serviceCategory) {
      Alert.alert('Missing service type', 'Please choose Automotive, Residential, or Commercial.');
      return;
    }

    if (!serviceWanted) {
      Alert.alert('Missing service wanted', 'Please choose what service the customer wants.');
      return;
    }

    if (serviceWanted === 'Other' && !customServiceWanted.trim()) {
      Alert.alert('Missing custom service', 'Please type the custom service wanted.');
      return;
    }

    if (serviceCategory === 'automotive') {
      if (!filmPackage) {
        Alert.alert('Missing film package', 'Please choose a film package.');
        return;
      }

      if (filmPackage === 'Other' && !customFilmPackage.trim()) {
        Alert.alert('Missing custom film package', 'Please type the custom film package.');
        return;
      }

      if (!productNameInput.trim()) {
        Alert.alert('Missing product', 'Please enter the product used.');
        return;
      }

      if (!rollWidth) {
        Alert.alert('Missing roll width', 'Please choose the roll width.');
        return;
      }

      if (!rollLengthFeet.trim()) {
        Alert.alert('Missing roll length', 'Please enter the roll length in feet.');
        return;
      }
    }

    let safeWindowItems: WindowLineItem[] = [];
    let totalWindowSqFt = 0;
    let materialCost: number | null = null;
    let matchedProductKey: string | null = null;

    if (serviceCategory === 'automotive') {
      matchedProductKey = findClosestFilmProduct(productNameInput.trim());
    }

    if (serviceCategory === 'residential' || serviceCategory === 'commercial') {
      if (!glassType) {
        Alert.alert('Missing glass type', 'Please choose a glass type.');
        return;
      }

      if (glassType === 'Other' && !customGlassType.trim()) {
        Alert.alert('Missing custom glass type', 'Please type the custom glass type.');
        return;
      }

      const totals = getWindowTotals(windowLineItems);
      safeWindowItems = totals.safeItems;
      totalWindowSqFt = totals.totalWindowSqFt;
      materialCost = totals.totalMaterialCost;

      const hasInvalid = safeWindowItems.some(
        (item) =>
          !item.productNameInput.trim() ||
          !item.rollWidth ||
          !item.rollLengthFeet.trim() ||
          !item.windowWidthInches.trim() ||
          !item.windowHeightInches.trim()
      );

      if (hasInvalid) {
        Alert.alert(
          'Missing window info',
          'Please fill product, roll width, roll length, window width, and window height for every window.'
        );
        return;
      }
    }

    if (appointmentEnabled && !appointmentDate) {
      Alert.alert('Set appointment', 'Pick date and time, then tap Set Appointment.');
      return;
    }

    const finalServiceWanted =
      serviceWanted === 'Other' ? customServiceWanted.trim() : serviceWanted;

    const finalFilmPackage =
      filmPackage === 'Other' ? customFilmPackage.trim() : filmPackage;

    const finalGlassType =
      glassType === 'Other' ? customGlassType.trim() : glassType;

    const newStatus: JobStatus = appointmentEnabled
      ? 'awaiting_confirmation'
      : 'called';

    const newJob: Job = {
      id: editingJobId || `job_${Date.now()}`,
      createdAt: new Date().toISOString(),
      serviceCategory,
      serviceWanted: finalServiceWanted,
      filmPackage: finalFilmPackage,
      quoteAmount: quoteAmount.trim(),
      leadSource: leadSource.trim(),
      notes: notes.trim(),
      isPaid,
      status: isPaid ? 'completed_paid' : newStatus,
      paymentLinkSentAt: null,
      paidInCashAt: null,
      reviewRequestedAt: null,
      appointmentAt: appointmentEnabled ? appointmentDate : null,
      finishedAt: isPaid ? new Date().toISOString() : null,
      beforePhotoUri: null,
      afterPhotoUri: null,
      beforeVideoUri: null,
      afterVideoUri: null,
      vehicleYear: vehicleYear.trim(),
      vehicleMake: vehicleMake.trim(),
      vehicleModel: vehicleModel.trim(),
      glassType: finalGlassType,
      filmType: filmType.trim(),
      squareFeet:
        serviceCategory === 'residential' || serviceCategory === 'commercial'
          ? `${totalWindowSqFt}`
          : squareFeet.trim(),
      aiEstimatedSqFt: null,
      materialCost,
      productNameInput: productNameInput.trim(),
      matchedProductKey,
      rollWidth,
      rollLengthFeet: rollLengthFeet.trim(),
      windowLineItems: safeWindowItems,
      totalWindowSqFt,
    };

    if (editingCustomerId && editingJobId) {
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === editingCustomerId
            ? {
                ...customer,
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim(),
                address: address.trim(),
                jobs: customer.jobs.map((job) =>
                  job.id === editingJobId
                    ? {
                        ...job,
                        ...newJob,
                        status:
                          job.status === 'finished_unpaid' ||
                          job.status === 'completed_paid'
                            ? job.status
                            : newJob.status,
                        finishedAt: job.finishedAt,
                        reviewRequestedAt: job.reviewRequestedAt,
                        paymentLinkSentAt: job.paymentLinkSentAt,
                        paidInCashAt: job.paidInCashAt,
                        beforePhotoUri: job.beforePhotoUri,
                        afterPhotoUri: job.afterPhotoUri,
                        beforeVideoUri: job.beforeVideoUri,
                        afterVideoUri: job.afterVideoUri,
                        aiEstimatedSqFt: job.aiEstimatedSqFt ?? null,
                      }
                    : job
                ),
              }
            : customer
        )
      );

      resetForm();
      return;
    }

    const matchedCustomer = customers.find(
      (customer) =>
        customer.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );

    if (matchedCustomer) {
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === matchedCustomer.id
            ? {
                ...customer,
                name: name.trim() || customer.name,
                phone: phone.trim() || customer.phone,
                email: email.trim() || customer.email,
                address: address.trim() || customer.address,
                jobs: [newJob, ...customer.jobs],
              }
            : customer
        )
      );
    } else {
      const newCustomer: Customer = {
        id: `customer_${Date.now()}`,
        number: getNextCustomerNumber(),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        createdAt: new Date().toISOString(),
        lastCalledAt: null,
        reviewLinkSentEver: false,
        jobs: [newJob],
      };

      setCustomers((prev) => [newCustomer, ...prev]);
    }

    resetForm();
  };

  const handleDeleteCustomer = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    Alert.alert('Delete Customer', `Delete ${customer.name} and all jobs?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setCustomers((prev) => prev.filter((c) => c.id !== customerId));
          try {
            await deleteDoc(doc(db, 'customers', customerId));
          } catch (error) {
            console.log('Firebase delete customer failed:', error);
          }
        },
      },
    ]);
  };

  const handleDeleteJob = (customerId: string, jobId: string) => {
    const targetCustomer = customers.find((c) => c.id === customerId);
    if (!targetCustomer) return;

    const updatedJobs = targetCustomer.jobs.filter((job) => job.id !== jobId);

    if (updatedJobs.length === 0) {
      setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      deleteDoc(doc(db, 'customers', customerId)).catch((error) =>
        console.log('Firebase delete empty customer failed:', error)
      );
      return;
    }

    const nextCustomers = customers.map((customer) =>
      customer.id === customerId
        ? { ...customer, jobs: updatedJobs }
        : customer
    );

    setCustomers(nextCustomers);
  };

  const handleEditJob = (customer: Customer, job: Job) => {
    setEditingCustomerId(customer.id);
    setEditingJobId(job.id);

    setName(customer.name);
    setPhone(customer.phone);
    setEmail(customer.email);
    setAddress(customer.address);

    setServiceCategory(job.serviceCategory);

    const isAutomotiveOther =
      job.serviceCategory === 'automotive' &&
      !AUTOMOTIVE_SERVICES.includes(job.serviceWanted);
    const isResidentialOther =
      job.serviceCategory === 'residential' &&
      !RESIDENTIAL_SERVICES.includes(job.serviceWanted);
    const isCommercialOther =
      job.serviceCategory === 'commercial' &&
      !COMMERCIAL_SERVICES.includes(job.serviceWanted);

    if (isAutomotiveOther || isResidentialOther || isCommercialOther) {
      setServiceWanted('Other');
      setCustomServiceWanted(job.serviceWanted);
    } else {
      setServiceWanted(job.serviceWanted);
      setCustomServiceWanted('');
    }

    const isFilmOther =
      !!job.filmPackage && !FILM_PACKAGES.includes(job.filmPackage);
    if (isFilmOther) {
      setFilmPackage('Other');
      setCustomFilmPackage(job.filmPackage);
    } else {
      setFilmPackage(job.filmPackage);
      setCustomFilmPackage('');
    }

    const isGlassOther =
      !!job.glassType && !GLASS_TYPES.includes(job.glassType);
    if (isGlassOther) {
      setGlassType('Other');
      setCustomGlassType(job.glassType);
    } else {
      setGlassType(job.glassType);
      setCustomGlassType('');
    }

    setQuoteAmount(job.quoteAmount);
    setLeadSource(job.leadSource);
    setNotes(job.notes);
    setIsPaid(job.isPaid);

    setVehicleYear(job.vehicleYear);
    setVehicleMake(job.vehicleMake);
    setVehicleModel(job.vehicleModel);

    setFilmType(job.filmType);
    setSquareFeet(job.squareFeet);

    setProductNameInput(job.productNameInput || '');
    setRollWidth(job.rollWidth || '');
    setRollLengthFeet(job.rollLengthFeet || '100');
    setWindowLineItems(
      job.windowLineItems.length > 0
        ? job.windowLineItems.map(calculateWindowLineItem)
        : [createBlankWindowLineItem()]
    );

    setAppointmentEnabled(!!job.appointmentAt);

    if (job.appointmentAt) {
      const existingDate = new Date(job.appointmentAt);
      setAppointmentDate(job.appointmentAt);
      setDraftAppointmentDate(existingDate);
    } else {
      setAppointmentDate(null);
      setDraftAppointmentDate(new Date());
    }
  };

  const handleConfirmBooking = (customer: Customer, job: Job) => {
    if (!job.appointmentAt) {
      Alert.alert('Missing appointment', 'This job does not have an appointment date yet.');
      return;
    }

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              jobs: c.jobs.map((j) =>
                j.id === job.id ? { ...j, status: 'booked_confirmed' } : j
              ),
            }
          : c
      )
    );
  };

  const handleMoveBackToAwaiting = (customer: Customer, job: Job) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              jobs: c.jobs.map((j) =>
                j.id === job.id ? { ...j, status: 'awaiting_confirmation' } : j
              ),
            }
          : c
      )
    );
  };

  const openFinishScreen = (customer: Customer, job: Job) => {
    setFinishCustomerId(customer.id);
    setFinishJobId(job.id);
    setFinishBeforePhotoUri(job.beforePhotoUri);
    setFinishAfterPhotoUri(job.afterPhotoUri);
    setFinishBeforeVideoUri(job.beforeVideoUri);
    setFinishAfterVideoUri(job.afterVideoUri);
    setScreen('finish');
  };

  const closeFinishScreen = () => {
    resetFinishScreen();
    setScreen('main');
  };

  const handleCallCustomer = async (customer: Customer) => {
    if (!customer.phone) return;

    try {
      const cleaned = customer.phone.replace(/\D/g, '');
      const url = `tel:${cleaned}`;
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);

        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id
              ? { ...c, lastCalledAt: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (error) {
      console.log('Call failed:', error);
    }
  };

  const handleEmailCustomer = async (customer: Customer) => {
    if (!customer.email) return;

    try {
      const url = `mailto:${customer.email}`;
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.log('Email failed:', error);
    }
  };

  const handleOpenMaps = async (customer: Customer) => {
    if (!customer.address) return;

    try {
      const encoded = encodeURIComponent(customer.address);
      const url = `http://maps.apple.com/?q=${encoded}`;
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.log('Maps failed:', error);
    }
  };

  const sendPaymentLinkSMS = async (customer: Customer, job: Job) => {
    if (isSendingSMS) {
      Alert.alert('Please wait', 'SMS is already opening. Finish that first.');
      return;
    }

    if (!customer.phone) {
      Alert.alert('Missing phone', 'This customer does not have a phone number.');
      return;
    }

    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert('SMS unavailable', 'Text messaging is not available on this device.');
      return;
    }

    const amount = job.quoteAmount ? `$${job.quoteAmount}` : 'the balance';
    const reason = job.serviceWanted || 'service';

    const message =
      `Hi ${customer.name}, here is your payment info for your ${reason}.` +
      `\nAmount due: ${amount}` +
      `\n\nPay with Zelle: ${appZellePayTo}` +
      `\nOr pay with Stripe: ${appPaymentLink}` +
      `\n\nIf you have any questions, call or text ${appBusinessPhone}.`;

    try {
      setIsSendingSMS(true);
      const result = await SMS.sendSMSAsync([customer.phone], message);

      if (result.result === 'sent' || result.result === 'unknown') {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id
              ? {
                  ...c,
                  jobs: c.jobs.map((j) =>
                    j.id === job.id
                      ? { ...j, paymentLinkSentAt: new Date().toISOString() }
                      : j
                  ),
                }
              : c
          )
        );
      }
    } catch (error) {
      console.log('Payment SMS failed:', error);
      Alert.alert('SMS busy', 'Close the previous text message and try again.');
    } finally {
      setIsSendingSMS(false);
    }
  };

  const sendReviewOnlySMS = async (customer: Customer, job: Job) => {
    if (isSendingSMS) {
      Alert.alert('Please wait', 'SMS is already opening. Finish that first.');
      return;
    }

    if (!customer.phone) {
      Alert.alert('Missing phone', 'This customer does not have a phone number.');
      return;
    }

    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert('SMS unavailable', 'Text messaging is not available on this device.');
      return;
    }

    const reason = job.serviceWanted || 'service';

    const message =
      `Hi ${customer.name}, thank you again for choosing us for your ${reason}.` +
      `\n\nIf you were happy with the service, we’d really appreciate a Google review. We hope we earned 5 stars.` +
      `\n${appGoogleReviewLink}` +
      `\n\nIf you need anything, call or text ${appBusinessPhone}.`;

    try {
      setIsSendingSMS(true);
      const result = await SMS.sendSMSAsync([customer.phone], message);

      if (result.result === 'sent' || result.result === 'unknown') {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id
              ? {
                  ...c,
                  reviewLinkSentEver: true,
                  jobs: c.jobs.map((j) =>
                    j.id === job.id
                      ? { ...j, reviewRequestedAt: new Date().toISOString() }
                      : j
                  ),
                }
              : c
          )
        );
      }
    } catch (error) {
      console.log('Review SMS failed:', error);
      Alert.alert('SMS busy', 'Close the previous text message and try again.');
    } finally {
      setIsSendingSMS(false);
    }
  };

  const sendCompletionFlowSMS = async (customer: Customer, job: Job) => {
    if (isSendingSMS) {
      Alert.alert('Please wait', 'SMS is already opening. Finish that first.');
      return;
    }

    if (!customer.phone) {
      Alert.alert('Missing phone', 'This customer does not have a phone number.');
      return;
    }

    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert('SMS unavailable', 'Text messaging is not available on this device.');
      return;
    }

    const amount = job.quoteAmount ? `$${job.quoteAmount}` : 'the balance';
    const reason = job.serviceWanted || 'service';

    let message = '';
    let shouldMarkReviewSent = false;
    let shouldMarkPaymentSent = false;

    if (!customer.reviewLinkSentEver) {
      shouldMarkReviewSent = true;

      if (job.isPaid) {
        message =
          `Hi ${customer.name}, your ${reason} is complete.` +
          `\n\nThank you again for your business. If you were happy with the service, we’d really appreciate a Google review. We hope we earned 5 stars.` +
          `\n${appGoogleReviewLink}` +
          `\n\nIf you need anything, call or text ${appBusinessPhone}.`;
      } else {
        shouldMarkPaymentSent = true;
        message =
          `Hi ${customer.name}, your ${reason} is complete.` +
          `\nAmount due: ${amount}` +
          `\n\nPay with Zelle: ${appZellePayTo}` +
          `\nOr pay with Stripe: ${appPaymentLink}` +
          `\n\nIf you have any questions, call or text ${appBusinessPhone}.`;
      }
    } else {
      if (job.isPaid) {
        return;
      }

      shouldMarkPaymentSent = true;
      message =
        `Hi ${customer.name}, your ${reason} is complete.` +
        `\n\nPay with Zelle: ${appZellePayTo}` +
        `\nOr pay with Stripe: ${appPaymentLink}` +
        `\n\nIf you have any questions, call or text ${appBusinessPhone}.`;
    }

    try {
      setIsSendingSMS(true);

      const result = await SMS.sendSMSAsync([customer.phone], message);

      if (result.result === 'sent' || result.result === 'unknown') {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id
              ? {
                  ...c,
                  reviewLinkSentEver: shouldMarkReviewSent
                    ? true
                    : c.reviewLinkSentEver,
                  jobs: c.jobs.map((j) =>
                    j.id === job.id
                      ? {
                          ...j,
                          reviewRequestedAt: shouldMarkReviewSent
                            ? new Date().toISOString()
                            : j.reviewRequestedAt,
                          paymentLinkSentAt: shouldMarkPaymentSent
                            ? new Date().toISOString()
                            : j.paymentLinkSentAt,
                        }
                      : j
                  ),
                }
              : c
          )
        );
      }
    } catch (error) {
      console.log('Completion SMS failed:', error);
      Alert.alert(
        'SMS busy',
        'Your text message app is still busy. Close the previous message and try again.'
      );
    } finally {
      setIsSendingSMS(false);
    }
  };

  const handleOpenGoogleReviewsDashboard = async () => {
    try {
      const url = appGoogleReviewLink;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.log('Open Google reviews failed:', error);
    }
  };

  const handlePaidInCash = (customer: Customer, job: Job) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              jobs: c.jobs.map((j) => {
                if (j.id !== job.id) return j;

                let nextStatus = j.status;
                if (j.status === 'finished_unpaid') {
                  nextStatus = 'completed_paid';
                }

                return {
                  ...j,
                  isPaid: true,
                  paidInCashAt: new Date().toISOString(),
                  status: nextStatus,
                };
              }),
            }
          : c
      )
    );
  };

  const confirmFinishJob = async () => {
    if (isFinishingJob) return;

    const customer = customers.find((c) => c.id === finishCustomerId);
    const job = customer?.jobs.find((j) => j.id === finishJobId);

    if (!customer || !job) return;

    if (
      !finishBeforePhotoUri ||
      !finishAfterPhotoUri ||
      !finishBeforeVideoUri ||
      !finishAfterVideoUri
    ) {
      Alert.alert(
        'Missing media',
        'Before confirming finish, add: before photo, after photo, before walkaround video, and after walkaround video.'
      );
      return;
    }

    try {
      setIsFinishingJob(true);

      const updatedJob: Job = {
        ...job,
        status: job.isPaid ? 'completed_paid' : 'finished_unpaid',
        finishedAt: new Date().toISOString(),
        beforePhotoUri: finishBeforePhotoUri,
        afterPhotoUri: finishAfterPhotoUri,
        beforeVideoUri: finishBeforeVideoUri,
        afterVideoUri: finishAfterVideoUri,
      };

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customer.id
            ? {
                ...c,
                jobs: c.jobs.map((j) => (j.id === job.id ? updatedJob : j)),
              }
            : c
        )
      );

      closeFinishScreen();

      try {
        await sendCompletionFlowSMS(customer, updatedJob);
      } catch (error) {
        console.log('Completion SMS failed:', error);
      }

      if (job.serviceCategory === 'automotive') {
        setIsEstimatingAI(true);

        estimateTintWithAI(updatedJob)
          .then((estimate) => {
            const costInfo = getAutomotiveMaterialCost(
              updatedJob.productNameInput || updatedJob.filmPackage,
              updatedJob.rollWidth || '60',
              updatedJob.rollLengthFeet || '100',
              estimate
            );

            updateJobAIEstimate(
              customer.id,
              job.id,
              estimate,
              costInfo.materialCost,
              costInfo.matchedProductKey
            );
          })
          .catch((error) => {
            console.log('Background AI estimate failed:', error);
          })
          .finally(() => {
            setIsEstimatingAI(false);
          });
      }
    } finally {
      setIsFinishingJob(false);
    }
  };

  const handleTogglePaid = (customer: Customer, job: Job) => {
    const nextPaid = !job.isPaid;

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              ...c,
              jobs: c.jobs.map((j) => {
                if (j.id !== job.id) return j;

                let nextStatus = j.status;
                if (nextPaid && j.status === 'finished_unpaid') {
                  nextStatus = 'completed_paid';
                } else if (!nextPaid && j.status === 'completed_paid') {
                  nextStatus = 'finished_unpaid';
                }

                return {
                  ...j,
                  isPaid: nextPaid,
                  paidInCashAt: nextPaid ? j.paidInCashAt : null,
                  status: nextStatus,
                };
              }),
            }
          : c
      )
    );
  };

  const onChangeDate = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) {
      setShowDatePicker(false);
      return;
    }

    const next = new Date(draftAppointmentDate);
    next.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    );
    setDraftAppointmentDate(next);
  };

  const onChangeTime = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) {
      setShowTimePicker(false);
      return;
    }

    const next = new Date(draftAppointmentDate);
    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    setDraftAppointmentDate(next);
  };

  const handleSetAppointment = () => {
    setAppointmentDate(draftAppointmentDate.toISOString());
    setShowDatePicker(false);
    setShowTimePicker(false);
    Alert.alert('Appointment set', draftAppointmentDate.toLocaleString());
  };

  const handleClearAppointment = () => {
    setAppointmentDate(null);
    setAppointmentEnabled(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const formatLastCalled = (value: string | null) => {
    if (!value) return 'Never called';
    return `Last called: ${new Date(value).toLocaleString()}`;
  };

  const formatAppointment = (value: string | null) => {
    if (!value) return 'No appointment';
    return new Date(value).toLocaleString();
  };

  const getTimeUntilAppointment = (value: string | null) => {
    if (!value) return '';

    const appointment = new Date(value).getTime();
    const now = Date.now();
    const diff = appointment - now;

    if (diff <= 0) return '⏳ Appointment time passed';

    const totalMinutes = Math.floor(diff / (1000 * 60));
    const totalHours = Math.floor(diff / (1000 * 60 * 60));
    const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (totalDays >= 1) {
      return `⏳ In ${totalDays} day${totalDays > 1 ? 's' : ''}`;
    }

    if (totalHours >= 1) {
      return `⏳ In ${totalHours} hour${totalHours > 1 ? 's' : ''}`;
    }

    return `⏳ In ${totalMinutes} minute${totalMinutes > 1 ? 's' : ''}`;
  };

  const isSameMonth = (isoDate: string | null, now: Date) => {
    if (!isoDate) return false;
    const date = new Date(isoDate);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  };

  const stats = useMemo(() => {
    const allJobs = customers.flatMap((c) => c.jobs);
    const now = new Date();

    const totalCustomers = customers.filter((c) => c.jobs.length > 0).length;
    const calledCount = allJobs.filter((j) => j.status === 'called').length;
    const awaitingCount = allJobs.filter((j) => j.status === 'awaiting_confirmation').length;
    const bookedCount = allJobs.filter((j) => j.status === 'booked_confirmed').length;
    const unpaidFinishedCount = allJobs.filter((j) => j.status === 'finished_unpaid').length;
    const completedPaidCount = allJobs.filter((j) => j.status === 'completed_paid').length;
    const totalQuoted = allJobs.reduce((sum, job) => sum + parseAmount(job.quoteAmount), 0);
    const paidRevenue = allJobs
      .filter((job) => job.isPaid)
      .reduce((sum, job) => sum + parseAmount(job.quoteAmount), 0);

    const monthlyJobs = allJobs.filter(
      (job) => isSameMonth(job.createdAt, now) || isSameMonth(job.finishedAt, now)
    );

    const monthlyRevenue = monthlyJobs
      .filter((job) => job.isPaid)
      .reduce((sum, job) => sum + parseAmount(job.quoteAmount), 0);

    const monthlyOutstanding = monthlyJobs
      .filter((job) => !job.isPaid)
      .reduce((sum, job) => sum + parseAmount(job.quoteAmount), 0);

    const monthlyBookings = monthlyJobs.length;

    const monthlyMaterialCost = monthlyJobs.reduce(
      (sum, job) => sum + (job.materialCost || 0),
      0
    );

    const monthlyProfit = monthlyRevenue - monthlyMaterialCost;

    return {
      totalCustomers,
      calledCount,
      awaitingCount,
      bookedCount,
      unpaidFinishedCount,
      completedPaidCount,
      paidRevenue,
      outstanding: totalQuoted - paidRevenue,
      monthlyRevenue,
      monthlyOutstanding,
      monthlyBookings,
      monthlyMaterialCost,
      monthlyProfit,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;

    return customers.filter((customer) => {
      const customerMatch =
        customer.name.toLowerCase().includes(q) ||
        customer.phone.toLowerCase().includes(q) ||
        customer.email.toLowerCase().includes(q) ||
        customer.address.toLowerCase().includes(q);

      const jobMatch = customer.jobs.some((job) => {
        const lineItemText = job.windowLineItems
          .map((item) => `${item.productNameInput} ${item.rollWidth} ${item.rollLengthFeet}`)
          .join(' ');

        const details = [
          job.serviceCategory,
          job.serviceWanted,
          job.filmPackage,
          job.glassType,
          job.filmType,
          job.squareFeet,
          job.notes,
          job.leadSource,
          buildVehicleLabel(job),
          buildScopeLabel(job),
          job.aiEstimatedSqFt ? `${job.aiEstimatedSqFt}` : '',
          job.materialCost ? `${job.materialCost}` : '',
          job.productNameInput,
          job.matchedProductKey || '',
          job.rollWidth,
          job.rollLengthFeet,
          lineItemText,
        ]
          .join(' ')
          .toLowerCase();

        return details.includes(q);
      });

      return customerMatch || jobMatch;
    });
  }, [customers, search]);

  const filterCustomersByLatestJobStatus = (status: JobStatus) => {
    return filteredCustomers.filter((customer) => {
      const latestJob = getLatestJob(customer);
      return latestJob?.status === status;
    });
  };

  const calledCustomers = filterCustomersByLatestJobStatus('called');
  const awaitingCustomers = filterCustomersByLatestJobStatus('awaiting_confirmation');
  const bookedCustomers = filterCustomersByLatestJobStatus('booked_confirmed');
  const unpaidFinishedCustomers = filterCustomersByLatestJobStatus('finished_unpaid');
  const completedPaidCustomers = filterCustomersByLatestJobStatus('completed_paid');

  const statusLabel = (status: JobStatus) => {
    switch (status) {
      case 'called':
        return 'Called';
      case 'awaiting_confirmation':
        return 'Awaiting';
      case 'booked_confirmed':
        return 'Booked';
      case 'finished_unpaid':
        return 'Unpaid';
      case 'completed_paid':
        return 'Completed';
      default:
        return status;
    }
  };

  const statusStyle = (status: JobStatus) => {
    switch (status) {
      case 'called':
        return styles.calledPill;
      case 'awaiting_confirmation':
        return styles.awaitingPill;
      case 'booked_confirmed':
        return styles.bookedPill;
      case 'finished_unpaid':
        return styles.unpaidPill;
      case 'completed_paid':
        return styles.finishedPill;
      default:
        return styles.calledPill;
    }
  };

  const mediaBadge = (label: string, ready: boolean) => (
    <View style={[styles.mediaBadge, ready ? styles.mediaReady : styles.mediaMissing]}>
      <Text style={styles.buttonText}>{label}</Text>
    </View>
  );

  const renderWindowLineItem = (item: WindowLineItem, index: number) => (
    <View key={item.id} style={styles.windowItemCard}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={[styles.finishCardTitle, { marginBottom: 0 }]}>
          Window {index + 1}
        </Text>

        {windowLineItems.length > 1 && (
          <TouchableOpacity
            onPress={() => removeWindowLineItem(item.id)}
            style={{
              backgroundColor: '#7f1d1d',
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>
              Remove
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.label}>Product</Text>
      <TextInput
        placeholder="e.g. Max Night Vista 20%"
        placeholderTextColor="gray"
        value={item.productNameInput}
        onChangeText={(text) => updateWindowLineItem(item.id, 'productNameInput', text)}
        style={styles.input}
      />

      <Text style={styles.metaText}>
        Match: {item.matchedProductKey || 'No match yet'}
      </Text>

      <Text style={styles.label}>Roll Width</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={item.rollWidth}
          onValueChange={(value) =>
            updateWindowLineItem(item.id, 'rollWidth', value as string)
          }
          dropdownIconColor="white"
          style={styles.picker}
        >
          {ROLL_WIDTH_OPTIONS.map((option) => (
            <Picker.Item
              key={option || 'blank'}
              label={option ? `${option}"` : 'Select width...'}
              value={option}
            />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Roll Length (feet)</Text>
      <TextInput
        placeholder="100"
        placeholderTextColor="gray"
        value={item.rollLengthFeet}
        onChangeText={(text) => updateWindowLineItem(item.id, 'rollLengthFeet', text)}
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.label}>Window Width (inches)</Text>
      <TextInput
        placeholder="48"
        placeholderTextColor="gray"
        value={item.windowWidthInches}
        onChangeText={(text) =>
          updateWindowLineItem(item.id, 'windowWidthInches', text)
        }
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.label}>Window Height (inches)</Text>
      <TextInput
        placeholder="60"
        placeholderTextColor="gray"
        value={item.windowHeightInches}
        onChangeText={(text) =>
          updateWindowLineItem(item.id, 'windowHeightInches', text)
        }
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.metaText}>Sq Ft: {item.squareFeet.toFixed(2)}</Text>
      <Text style={styles.metaText}>Material Cost: ${item.materialCost.toFixed(2)}</Text>
    </View>
  );

  const renderJobCard = (customer: Customer, job: Job, isPrimary = false) => (
    <View key={job.id} style={[styles.jobCard, !isPrimary && styles.jobCardSecondary]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardNumber}>
          {new Date(job.createdAt).toLocaleDateString()}
        </Text>
        <View style={[styles.statusPill, statusStyle(job.status)]}>
          <Text style={styles.statusPillText}>{statusLabel(job.status)}</Text>
        </View>
      </View>

      <Text style={styles.jobTitle}>
        {job.serviceCategory
          ? `${job.serviceCategory.charAt(0).toUpperCase()}${job.serviceCategory.slice(1)}`
          : 'Service'}{' '}
        • {job.serviceWanted || 'No service selected'}
      </Text>

      {job.serviceCategory === 'automotive' ? (
        <>
          {!!job.filmPackage && (
            <Text style={styles.metaText}>Film Package: {job.filmPackage}</Text>
          )}
          {!!job.productNameInput && (
            <Text style={styles.metaText}>Product: {job.productNameInput}</Text>
          )}
          {!!job.rollWidth && (
            <Text style={styles.metaText}>
              Roll: {job.rollWidth}" x {job.rollLengthFeet || '100'}'
            </Text>
          )}
          <Text style={styles.metaText}>
            Vehicle: {buildVehicleLabel(job) || 'No vehicle details'}
          </Text>
          {job.aiEstimatedSqFt !== null && (
            <Text style={styles.metaText}>
              AI Estimated Sq Ft: {job.aiEstimatedSqFt.toFixed(1)}
            </Text>
          )}
        </>
      ) : (
        <>
          {!!job.glassType && (
            <Text style={styles.metaText}>Glass Type: {job.glassType}</Text>
          )}
          {!!job.squareFeet && (
            <Text style={styles.metaText}>Square Feet: {job.squareFeet}</Text>
          )}
          {job.windowLineItems.length > 0 && (
            <Text style={styles.metaText}>
              Windows: {job.windowLineItems.length}
            </Text>
          )}
        </>
      )}

      {!!job.quoteAmount && (
        <Text style={styles.metaText}>Quote: ${job.quoteAmount}</Text>
      )}
      {job.materialCost !== null && (
        <Text style={styles.metaText}>
          Material Cost: ${job.materialCost.toFixed(2)}
        </Text>
      )}
      {!!job.leadSource && (
        <Text style={styles.metaText}>Source: {job.leadSource}</Text>
      )}

      <Text style={[styles.metaText, job.isPaid ? styles.paidText : styles.unpaidText]}>
        Payment: {job.isPaid ? 'Paid' : 'Unpaid'}
      </Text>

      {!!job.paidInCashAt && (
        <Text style={styles.metaText}>
          Paid in Cash: {new Date(job.paidInCashAt).toLocaleString()}
        </Text>
      )}

      {!!job.appointmentAt && (
        <>
          <Text style={styles.metaText}>
            Appointment: {formatAppointment(job.appointmentAt)}
          </Text>
          {!job.finishedAt && (
            <Text style={styles.timeUntilText}>
              {getTimeUntilAppointment(job.appointmentAt)}
            </Text>
          )}
        </>
      )}

      {!!job.finishedAt && (
        <Text style={styles.metaText}>
          Finished: {new Date(job.finishedAt).toLocaleString()}
        </Text>
      )}

      {!!job.notes && <Text style={styles.notesText}>Notes: {job.notes}</Text>}

      <Text style={styles.metaText}>
        Payment Link: {job.paymentLinkSentAt ? 'Payment info sent' : 'Not sent yet'}
      </Text>

      <Text style={styles.metaText}>
        Review: {job.reviewRequestedAt ? 'Review link sent' : 'Not requested yet'}
      </Text>

      <View style={styles.cardButtons}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditJob(customer, job)}
        >
          <Text style={styles.buttonText}>Edit Job</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={job.isPaid ? styles.paidButton : styles.markPaidButton}
          onPress={() => handleTogglePaid(customer, job)}
        >
          <Text style={styles.buttonText}>
            {job.isPaid ? 'Mark Unpaid' : 'Mark Paid'}
          </Text>
        </TouchableOpacity>

        {!job.isPaid && (
          <TouchableOpacity
            style={styles.cashPaidButton}
            onPress={() => handlePaidInCash(customer, job)}
          >
            <Text style={styles.buttonText}>Paid in Cash</Text>
          </TouchableOpacity>
        )}

        {job.status === 'awaiting_confirmation' && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => handleConfirmBooking(customer, job)}
          >
            <Text style={styles.buttonText}>Confirm Booking</Text>
          </TouchableOpacity>
        )}

        {job.status === 'booked_confirmed' && (
          <>
            <TouchableOpacity
              style={styles.finishButton}
              onPress={() => openFinishScreen(customer, job)}
            >
              <Text style={styles.buttonText}>Finish</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.awaitingButton}
              onPress={() => handleMoveBackToAwaiting(customer, job)}
            >
              <Text style={styles.buttonText}>Move Back</Text>
            </TouchableOpacity>
          </>
        )}

        {!job.isPaid && (
          <TouchableOpacity
            style={styles.paymentButton}
            onPress={() => sendPaymentLinkSMS(customer, job)}
          >
            <Text style={styles.buttonText}>Send Payment Link</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.reviewButton}
          onPress={() => sendReviewOnlySMS(customer, job)}
        >
          <Text style={styles.buttonText}>Send Review</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteJob(customer.id, job.id)}
        >
          <Text style={styles.buttonText}>Delete Job</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardButtons}>
        {mediaBadge('Before Photo', !!job.beforePhotoUri)}
        {mediaBadge('After Photo', !!job.afterPhotoUri)}
        {mediaBadge('Before Video', !!job.beforeVideoUri)}
        {mediaBadge('After Video', !!job.afterVideoUri)}
      </View>
    </View>
  );

  const renderCustomerCard = (customer: Customer) => {
    const sortedJobs = [...customer.jobs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latestJob = sortedJobs[0];
    const olderJobs = sortedJobs.slice(1);
    const expanded = expandedCustomerIds.includes(customer.id);

    if (!latestJob) return null;

    return (
      <View key={customer.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardNumber}>#{customer.number}</Text>
          <TouchableOpacity
            style={[styles.statusPill, statusStyle(latestJob.status)]}
            onPress={() => toggleCustomerExpanded(customer.id)}
          >
            <Text style={styles.statusPillText}>
              {statusLabel(latestJob.status)} • {customer.jobs.length} job
              {customer.jobs.length > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cardName}>{customer.name}</Text>

        {!!customer.address && (
          <TouchableOpacity onPress={() => handleOpenMaps(customer)}>
            <Text style={styles.linkText}>Address: {customer.address}</Text>
          </TouchableOpacity>
        )}

        {!!customer.phone && (
          <TouchableOpacity onPress={() => handleCallCustomer(customer)}>
            <Text style={styles.linkText}>{customer.phone}</Text>
          </TouchableOpacity>
        )}

        {!!customer.email && (
          <TouchableOpacity onPress={() => handleEmailCustomer(customer)}>
            <Text style={styles.linkText}>{customer.email}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.metaText}>{formatLastCalled(customer.lastCalledAt)}</Text>

        <View style={styles.cardButtons}>
          <TouchableOpacity
            style={styles.openGoogleButton}
            onPress={handleOpenGoogleReviewsDashboard}
          >
            <Text style={styles.buttonText}>Open Google Reviews</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteCustomer(customer.id)}
          >
            <Text style={styles.buttonText}>Delete Customer</Text>
          </TouchableOpacity>
        </View>

        {renderJobCard(customer, latestJob, true)}

        {olderJobs.length > 0 && (
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => toggleCustomerExpanded(customer.id)}
          >
            <Text style={styles.buttonText}>
              {expanded ? 'Hide Job History' : `Show Job History (${olderJobs.length})`}
            </Text>
          </TouchableOpacity>
        )}

        {expanded && olderJobs.map((job) => renderJobCard(customer, job, false))}
      </View>
    );
  };

  const finishCustomer = customers.find((c) => c.id === finishCustomerId);
  const finishJob = finishCustomer?.jobs.find((j) => j.id === finishJobId);

  if (screen === 'finish' && finishCustomer && finishJob) {
    const mediaButton = (
      title: string,
      uri: string | null,
      type: 'photo' | 'video',
      onPick: () => void,
      onRemove: () => void
    ) => (
      <View style={styles.finishCard}>
        <Text style={styles.finishCardTitle}>{title}</Text>

        {uri ? (
          <>
            {type === 'photo' ? (
              <Image source={{ uri }} style={styles.finishPreviewImage} />
            ) : (
              <VideoPreview uri={uri} />
            )}

            <View style={styles.cardButtons}>
              <TouchableOpacity style={styles.editButton} onPress={onPick}>
                <Text style={styles.buttonText}>Replace</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteButton} onPress={onRemove}>
                <Text style={styles.buttonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.finishButton} onPress={onPick}>
            <Text style={styles.buttonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Finish Job</Text>
        <Text style={styles.sectionTitle}>{finishCustomer.name}</Text>

        <Text style={styles.metaText}>
          Service Type:{' '}
          {finishJob.serviceCategory
            ? `${finishJob.serviceCategory.charAt(0).toUpperCase()}${finishJob.serviceCategory.slice(1)}`
            : 'Not selected'}
        </Text>

        <Text style={styles.metaText}>
          Service Wanted: {finishJob.serviceWanted || 'Not selected'}
        </Text>

        {finishJob.serviceCategory === 'automotive' ? (
          <>
            <Text style={styles.metaText}>
              Film Package: {finishJob.filmPackage || 'Not selected'}
            </Text>
            <Text style={styles.metaText}>
              Vehicle: {buildVehicleLabel(finishJob) || 'No vehicle details'}
            </Text>
            {finishJob.aiEstimatedSqFt !== null && (
              <Text style={styles.metaText}>
                Existing AI Estimate: {finishJob.aiEstimatedSqFt.toFixed(1)} sq ft
              </Text>
            )}
          </>
        ) : (
          <>
            <Text style={styles.metaText}>
              Glass Type: {finishJob.glassType || 'Not selected'}
            </Text>
            <Text style={styles.metaText}>
              Square Feet: {finishJob.squareFeet || 'Not entered'}
            </Text>
            {finishJob.materialCost !== null && (
              <Text style={styles.metaText}>
                Material Cost: ${finishJob.materialCost.toFixed(2)}
              </Text>
            )}
          </>
        )}

        <Text style={styles.metaText}>
          Quote: {finishJob.quoteAmount ? `$${finishJob.quoteAmount}` : 'No quote listed'}
        </Text>

        <Text style={styles.metaText}>
          Payment: {finishJob.isPaid ? 'Paid' : 'Unpaid'}
        </Text>

        {isEstimatingAI && (
          <Text style={styles.aiLoadingText}>Estimating square footage with AI...</Text>
        )}

        <Text style={styles.sectionTitle}>Required Media</Text>

        {mediaButton(
          'Before Photo',
          finishBeforePhotoUri,
          'photo',
          () => pickPhoto(setFinishBeforePhotoUri),
          () => setFinishBeforePhotoUri(null)
        )}

        {mediaButton(
          'After Photo',
          finishAfterPhotoUri,
          'photo',
          () => pickPhoto(setFinishAfterPhotoUri),
          () => setFinishAfterPhotoUri(null)
        )}

        {mediaButton(
          'Before Walkaround Video',
          finishBeforeVideoUri,
          'video',
          () => pickVideo(setFinishBeforeVideoUri),
          () => setFinishBeforeVideoUri(null)
        )}

        {mediaButton(
          'After Walkaround Video',
          finishAfterVideoUri,
          'video',
          () => pickVideo(setFinishAfterVideoUri),
          () => setFinishAfterVideoUri(null)
        )}

        <View style={styles.cardButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={closeFinishScreen}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={confirmFinishJob}>
            <Text style={styles.saveButtonText}>
              {isFinishingJob ? 'Finishing...' : 'Confirm Finish'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const windowTotals = getWindowTotals(windowLineItems);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My CRM app 👋</Text>

      <Text style={styles.sectionTitle}>This Month</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.monthlyBookings}</Text>
          <Text style={styles.statLabel}>Bookings</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>${stats.monthlyRevenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>${stats.monthlyOutstanding.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Outstanding</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            ${stats.monthlyMaterialCost.toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>Material Cost</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>${stats.monthlyProfit.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Profit</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Pipeline</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalCustomers}</Text>
          <Text style={styles.statLabel}>Customers</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.calledCount}</Text>
          <Text style={styles.statLabel}>Called</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.awaitingCount}</Text>
          <Text style={styles.statLabel}>Awaiting</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.bookedCount}</Text>
          <Text style={styles.statLabel}>Booked</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.unpaidFinishedCount}</Text>
          <Text style={styles.statLabel}>Unpaid Done</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.completedPaidCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>${stats.paidRevenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>${stats.outstanding.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Outstanding</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {editingJobId ? 'Edit Job' : 'Add Customer / Job'}
      </Text>

      <Text style={styles.label}>Customer Name</Text>
      <TextInput
        placeholder="Enter customer name"
        placeholderTextColor="gray"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <Text style={styles.label}>Phone</Text>
      <TextInput
        placeholder="Enter phone number"
        placeholderTextColor="gray"
        value={phone}
        onChangeText={(text) => setPhone(formatPhone(text))}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput
        placeholder="Enter email"
        placeholderTextColor="gray"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <Text style={styles.label}>Address</Text>
      <TextInput
        placeholder="Enter customer address"
        placeholderTextColor="gray"
        value={address}
        onChangeText={setAddress}
        style={styles.input}
      />

      <Text style={styles.sectionTitle}>Service Details</Text>

      <Text style={styles.label}>Service Type</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={serviceCategory}
          onValueChange={(value) => {
            setServiceCategory(value as ServiceCategory);
            setServiceWanted('');
            setFilmPackage('');
            setVehicleYear('');
            setVehicleMake('');
            setVehicleModel('');
            setGlassType('');
            setFilmType('');
            setSquareFeet('');
            setProductNameInput('');
            setRollWidth('');
            setRollLengthFeet('100');
            setWindowLineItems([createBlankWindowLineItem()]);
            setCustomServiceWanted('');
            setCustomFilmPackage('');
            setCustomGlassType('');
          }}
          dropdownIconColor="white"
          style={styles.picker}
        >
          <Picker.Item label="Select service type..." value="" />
          <Picker.Item label="Automotive" value="automotive" />
          <Picker.Item label="Residential" value="residential" />
          <Picker.Item label="Commercial" value="commercial" />
        </Picker>
      </View>

      {!!serviceCategory && (
        <>
          <Text style={styles.label}>Service Wanted</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={serviceWanted}
              onValueChange={(value) => {
                setServiceWanted(value);
                if (value !== 'Other') setCustomServiceWanted('');
              }}
              dropdownIconColor="white"
              style={styles.picker}
            >
              <Picker.Item label="Select service..." value="" />
              {getServiceOptions().map((option) => (
                <Picker.Item key={option} label={option} value={option} />
              ))}
            </Picker>
          </View>

          {serviceWanted === 'Other' && (
            <TextInput
              placeholder="Type custom service wanted"
              placeholderTextColor="gray"
              value={customServiceWanted}
              onChangeText={setCustomServiceWanted}
              style={styles.input}
            />
          )}
        </>
      )}

      {serviceCategory === 'automotive' && (
        <>
          <Text style={styles.sectionTitle}>Automotive Details</Text>

          <Text style={styles.label}>Film Package</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={filmPackage}
              onValueChange={(value) => {
                setFilmPackage(value);
                if (value !== 'Other') setCustomFilmPackage('');
                if (value !== 'Other') setProductNameInput(value);
              }}
              dropdownIconColor="white"
              style={styles.picker}
            >
              <Picker.Item label="Select package..." value="" />
              {FILM_PACKAGES.map((option) => (
                <Picker.Item key={option} label={option} value={option} />
              ))}
            </Picker>
          </View>

          {filmPackage === 'Other' && (
            <TextInput
              placeholder="Type custom film package"
              placeholderTextColor="gray"
              value={customFilmPackage}
              onChangeText={(text) => {
                setCustomFilmPackage(text);
                setProductNameInput(text);
              }}
              style={styles.input}
            />
          )}

          <Text style={styles.label}>Product Used</Text>
          <TextInput
            placeholder="Nano Ceramic Package"
            placeholderTextColor="gray"
            value={productNameInput}
            onChangeText={setProductNameInput}
            style={styles.input}
          />

          <Text style={styles.label}>Roll Width</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={rollWidth}
              onValueChange={(value) => setRollWidth(value as RollWidth)}
              dropdownIconColor="white"
              style={styles.picker}
            >
              {ROLL_WIDTH_OPTIONS.map((option) => (
                <Picker.Item
                  key={option || 'blank'}
                  label={option ? `${option}"` : 'Select width...'}
                  value={option}
                />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Roll Length (feet)</Text>
          <TextInput
            placeholder="100"
            placeholderTextColor="gray"
            value={rollLengthFeet}
            onChangeText={setRollLengthFeet}
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Year</Text>
          <TextInput
            placeholder="2022"
            placeholderTextColor="gray"
            value={vehicleYear}
            onChangeText={setVehicleYear}
            keyboardType="number-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Make</Text>
          <TextInput
            placeholder="Tesla"
            placeholderTextColor="gray"
            value={vehicleMake}
            onChangeText={setVehicleMake}
            style={styles.input}
          />

          <Text style={styles.label}>Model</Text>
          <TextInput
            placeholder="Model Y"
            placeholderTextColor="gray"
            value={vehicleModel}
            onChangeText={setVehicleModel}
            style={styles.input}
          />
        </>
      )}

      {(serviceCategory === 'residential' || serviceCategory === 'commercial') && (
        <>
          <Text style={styles.sectionTitle}>Project Details</Text>

          <Text style={styles.label}>Glass Type</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={glassType}
              onValueChange={(value) => {
                setGlassType(value);
                if (value !== 'Other') setCustomGlassType('');
              }}
              dropdownIconColor="white"
              style={styles.picker}
            >
              <Picker.Item label="Select glass type..." value="" />
              {GLASS_TYPES.map((option) => (
                <Picker.Item key={option} label={option} value={option} />
              ))}
            </Picker>
          </View>

          {glassType === 'Other' && (
            <TextInput
              placeholder="Type custom glass type"
              placeholderTextColor="gray"
              value={customGlassType}
              onChangeText={setCustomGlassType}
              style={styles.input}
            />
          )}

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Windows</Text>

            <TouchableOpacity
              onPress={addWindowLineItem}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#15803d',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: 'white', fontSize: 20, fontWeight: '800' }}>+</Text>
              <Text style={styles.buttonText}>Add Window</Text>
            </TouchableOpacity>
          </View>

          {windowLineItems.map(renderWindowLineItem)}

          <View style={styles.finishCard}>
            <Text style={styles.metaText}>
              Total Window Sq Ft: {windowTotals.totalWindowSqFt.toFixed(2)}
            </Text>
            <Text style={styles.metaText}>
              Total Material Cost: ${windowTotals.totalMaterialCost.toFixed(2)}
            </Text>
          </View>
        </>
      )}

      <Text style={styles.label}>Quote Amount</Text>
      <TextInput
        placeholder="250"
        placeholderTextColor="gray"
        value={quoteAmount}
        onChangeText={(text) => setQuoteAmount(formatMoneyInput(text))}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      <Text style={styles.label}>Lead Source</Text>
      <TextInput
        placeholder="Instagram, referral, website, walk-in"
        placeholderTextColor="gray"
        value={leadSource}
        onChangeText={setLeadSource}
        style={styles.input}
      />

      <View style={styles.paidRow}>
        <Text style={styles.checkboxLabel}>Already Paid</Text>
        <Switch value={isPaid} onValueChange={setIsPaid} />
      </View>

      <Text style={styles.label}>Job Notes</Text>
      <TextInput
        placeholder="Add job notes"
        placeholderTextColor="gray"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={[styles.input, styles.notesInput]}
      />

      <View style={styles.checkboxRow}>
        <TouchableOpacity
          style={[styles.checkbox, appointmentEnabled && styles.checkboxChecked]}
          onPress={() => {
            if (!appointmentEnabled) {
              setAppointmentEnabled(true);
            } else {
              setAppointmentEnabled(false);
              setAppointmentDate(null);
            }
          }}
        >
          <Text style={styles.checkboxText}>{appointmentEnabled ? '✓' : ''}</Text>
        </TouchableOpacity>
        <Text style={styles.checkboxLabel}>Appointment set</Text>
      </View>

      {appointmentEnabled && (
        <View style={styles.appointmentBox}>
          <Text style={styles.metaText}>
            Draft appointment: {draftAppointmentDate.toLocaleString()}
          </Text>

          <Text style={styles.metaText}>
            Saved appointment:{' '}
            {appointmentDate ? formatAppointment(appointmentDate) : 'Not set yet'}
          </Text>

          <View style={styles.cardButtons}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.buttonText}>Pick Date</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.buttonText}>Pick Time</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.finishButton}
              onPress={handleSetAppointment}
            >
              <Text style={styles.buttonText}>Set Appointment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleClearAppointment}
            >
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={draftAppointmentDate}
              mode="date"
              display="spinner"
              onChange={onChangeDate}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={draftAppointmentDate}
              mode="time"
              display="spinner"
              onChange={onChangeTime}
            />
          )}
        </View>
      )}

      {!!email && !isValidEmail(email) && (
        <Text style={styles.errorText}>Please enter a valid email.</Text>
      )}

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveCustomer}>
        <Text style={styles.saveButtonText}>
          {editingJobId ? 'Update Job' : 'Save Customer / Job'}
        </Text>
      </TouchableOpacity>

      {editingJobId && (
        <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>Search</Text>
      <TextInput
        placeholder="Search by customer, service, vehicle, film..."
        placeholderTextColor="gray"
        value={search}
        onChangeText={setSearch}
        style={styles.input}
      />

      <Text style={styles.sectionTitle}>Called / Leads</Text>
      {calledCustomers.length === 0 ? (
        <Text style={styles.emptyText}>No called leads.</Text>
      ) : (
        calledCustomers.map(renderCustomerCard)
      )}

      <Text style={styles.sectionTitle}>Awaiting Confirmation</Text>
      {awaitingCustomers.length === 0 ? (
        <Text style={styles.emptyText}>No jobs awaiting confirmation.</Text>
      ) : (
        awaitingCustomers.map(renderCustomerCard)
      )}

      <Text style={styles.sectionTitle}>Booked / Confirmed</Text>
      {bookedCustomers.length === 0 ? (
        <Text style={styles.emptyText}>No confirmed bookings.</Text>
      ) : (
        bookedCustomers.map(renderCustomerCard)
      )}

      <Text style={styles.sectionTitle}>Finished / Unpaid</Text>
      {unpaidFinishedCustomers.length === 0 ? (
        <Text style={styles.emptyText}>No finished unpaid jobs.</Text>
      ) : (
        unpaidFinishedCustomers.map(renderCustomerCard)
      )}

      <Text style={styles.sectionTitle}>Completed / Paid</Text>
      {completedPaidCustomers.length === 0 ? (
        <Text style={styles.emptyText}>No completed paid jobs.</Text>
      ) : (
        completedPaidCustomers.map(renderCustomerCard)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 50,
    backgroundColor: '#020817',
    minHeight: '100%',
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: 'white',
    marginBottom: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#08132e',
    borderWidth: 1,
    borderColor: '#1f2a44',
    borderRadius: 18,
    padding: 16,
    width: '47%',
  },
  statNumber: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
    marginTop: 12,
    marginBottom: 12,
  },
  label: {
    color: '#e5e7eb',
    marginBottom: 8,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#26324f',
    backgroundColor: '#08132e',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    color: 'white',
    width: '100%',
    fontSize: 16,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#26324f',
    backgroundColor: '#08132e',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    color: 'white',
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  paidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxText: {
    color: 'white',
    fontWeight: '800',
  },
  checkboxLabel: {
    color: 'white',
    fontSize: 16,
  },
  appointmentBox: {
    backgroundColor: '#08132e',
    borderWidth: 1,
    borderColor: '#26324f',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 14,
    flexGrow: 1,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  },
  cancelButton: {
    backgroundColor: '#374151',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 18,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#08132e',
    borderRadius: 20,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1f2a44',
  },
  jobCard: {
    backgroundColor: '#0b1735',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#243557',
  },
  jobCardSecondary: {
    backgroundColor: '#0a1328',
  },
  jobTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  historyButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 14,
    alignItems: 'center',
  },
  finishCard: {
    backgroundColor: '#08132e',
    borderWidth: 1,
    borderColor: '#1f2a44',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  finishCardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  finishPreviewImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 12,
  },
  video: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#111827',
  },
  windowItemCard: {
    backgroundColor: '#0b1735',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#243557',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardNumber: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  calledPill: {
    backgroundColor: '#a16207',
  },
  awaitingPill: {
    backgroundColor: '#7c3aed',
  },
  bookedPill: {
    backgroundColor: '#1d4ed8',
  },
  unpaidPill: {
    backgroundColor: '#b91c1c',
  },
  finishedPill: {
    backgroundColor: '#15803d',
  },
  statusPillText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  cardName: {
    color: 'white',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  linkText: {
    color: '#93c5fd',
    fontSize: 16,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  metaText: {
    color: '#dbe4f0',
    fontSize: 14,
    marginTop: 6,
  },
  paidText: {
    color: '#4ade80',
    fontWeight: '700',
  },
  unpaidText: {
    color: '#f87171',
    fontWeight: '700',
  },
  timeUntilText: {
    color: '#facc15',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '700',
  },
  notesText: {
    color: '#e5e7eb',
    fontSize: 15,
    marginTop: 10,
    lineHeight: 22,
  },
  aiLoadingText: {
    color: '#38bdf8',
    fontSize: 15,
    marginTop: 8,
    marginBottom: 12,
    fontWeight: '700',
  },
  cardButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 16,
  },
  mediaBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  mediaReady: {
    backgroundColor: '#065f46',
  },
  mediaMissing: {
    backgroundColor: '#92400e',
  },
  editButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  confirmButton: {
    backgroundColor: '#0f766e',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  awaitingButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  reviewButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  paymentButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  cashPaidButton: {
    backgroundColor: '#92400e',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  openGoogleButton: {
    backgroundColor: '#1f2937',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  markPaidButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  paidButton: {
    backgroundColor: '#065f46',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  finishButton: {
    backgroundColor: '#15803d',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  deleteButton: {
    backgroundColor: '#991b1b',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  buttonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 6,
  },
  errorText: {
    color: '#f87171',
    marginTop: -8,
    marginBottom: 12,
  },
});
