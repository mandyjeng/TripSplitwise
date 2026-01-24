
import React from 'react';
import { 
  Home, 
  Bus, 
  Utensils, 
  Ticket, 
  ShieldCheck, 
  MoreHorizontal,
  LayoutDashboard,
  ListOrdered,
  Settings as SettingsIcon,
  PlusCircle,
  Camera,
  User,
  ArrowRightLeft,
  UserCheck
} from 'lucide-react';
import { Category } from './types';

export const CATEGORIES: Category[] = ['住宿', '交通', '門票', '用餐', '雜項', '保險', '個人消費'];

export const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  '住宿': <Home size={18} />,
  '交通': <Bus size={18} />,
  '用餐': <Utensils size={18} />,
  '門票': <Ticket size={18} />,
  '保險': <ShieldCheck size={18} />,
  '雜項': <MoreHorizontal size={18} />,
  '個人消費': <UserCheck size={18} />,
};

export const CATEGORY_COLORS: Record<Category, string> = {
  '住宿': 'bg-blue-100 text-blue-600',
  '交通': 'bg-green-100 text-green-600',
  '用餐': 'bg-orange-100 text-orange-600',
  '門票': 'bg-purple-100 text-purple-600',
  '保險': 'bg-teal-100 text-teal-600',
  '雜項': 'bg-gray-100 text-gray-600',
  '個人消費': 'bg-pink-100 text-pink-600',
};

export const TABS = [
  { id: 'overview', label: '總覽', icon: <LayoutDashboard size={20} /> },
  { id: 'details', label: '明細', icon: <ListOrdered size={20} /> },
  { id: 'settings', label: '設定', icon: <SettingsIcon size={20} /> },
];
