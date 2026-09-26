import { useQuery } from '@tanstack/react-query';
import * as backend from '../../services/backend';

// Misma queryKey en Home y en el detalle: al abrir un banner ya está en caché.
export const useNews = () => useQuery({ queryKey: ['news'], queryFn: backend.listNews });
