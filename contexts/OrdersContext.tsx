import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  image?: any;
}

export interface Order {
  id: string;
  tableNumber: number;
  items: OrderItem[];
  progress: number;
  createdAt: Date;
  userId: string;
}

interface OrdersContextType {
  orders: Order[];
  loading: boolean;
  addOrder: (tableNumber: number, items: OrderItem[]) => Promise<void>;
  updateOrderProgress: (orderId: string, progress: number) => Promise<void>;
  removeOrder: (orderId: string) => Promise<void>;
  refreshOrders: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch orders from Supabase
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch orders with their items
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        setLoading(false);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch order items for all orders
      const orderIds = ordersData.map((order) => order.id);
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        setLoading(false);
        return;
      }

      // Combine orders with their items
      const ordersWithItems: Order[] = ordersData.map((order) => {
        const items: OrderItem[] = (orderItemsData || [])
          .filter((item) => item.order_id === order.id)
          .map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
          }));

        return {
          id: order.id,
          tableNumber: order.table_number,
          items,
          progress: parseFloat(order.progress.toString()),
          createdAt: new Date(order.created_at),
          userId: order.user_id,
        };
      });

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error in fetchOrders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load orders on mount and when auth state changes
  useEffect(() => {
    fetchOrders();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchOrders();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const addOrder = async (tableNumber: number, items: OrderItem[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Insert order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: user.id,
            table_number: tableNumber,
            progress: 1.0,
          },
        ])
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        throw orderError;
      }

      // Insert order items
      const orderItemsToInsert = items.map((item) => ({
        order_id: orderData.id,
        name: item.name,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Rollback: delete the order if items insertion fails
        await supabase.from('orders').delete().eq('id', orderData.id);
        throw itemsError;
      }

      // Refresh orders
      await fetchOrders();
    } catch (error) {
      console.error('Error in addOrder:', error);
      throw error;
    }
  };

  const updateOrderProgress = async (orderId: string, progress: number) => {
    try {
      const clampedProgress = Math.max(0, Math.min(1, progress));
      
      const { error } = await supabase
        .from('orders')
        .update({ progress: clampedProgress })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order progress:', error);
        throw error;
      }

      // Refresh orders
      await fetchOrders();
    } catch (error) {
      console.error('Error in updateOrderProgress:', error);
      throw error;
    }
  };

  const removeOrder = async (orderId: string) => {
    try {
      // Delete order (order_items will be deleted automatically due to CASCADE)
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) {
        console.error('Error removing order:', error);
        throw error;
      }

      // Refresh orders
      await fetchOrders();
    } catch (error) {
      console.error('Error in removeOrder:', error);
      throw error;
    }
  };

  return (
    <OrdersContext.Provider 
      value={{ 
        orders, 
        loading,
        addOrder, 
        updateOrderProgress, 
        removeOrder,
        refreshOrders: fetchOrders,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
}
