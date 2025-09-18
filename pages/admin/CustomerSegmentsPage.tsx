import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { User, UserRole } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PieChartIcon, FilterIcon, UsersIcon, User as UserIconLucide, Phone, Tag, CalendarDays } from 'lucide-react';

const CustomerSegmentsPage: React.FC = () => {
    const { users, orders } = useData();

    const [filters, setFilters] = useState({
        tags: '',
        lastOrderDays: '',
        newCustomerDays: '',
    });
    const [activeFilters, setActiveFilters] = useState<typeof filters | null>(null);

    const customers = useMemo(() => users.filter(u => u.role === UserRole.CUSTOMER), [users]);

    const lastOrderDateMap = useMemo(() => {
        const map = new Map<string, Date>();
        const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        for (const order of sortedOrders) {
            if (!map.has(order.customer.id)) {
                map.set(order.customer.id, new Date(order.createdAt));
            }
        }
        return map;
    }, [orders]);

    const filteredCustomers = useMemo(() => {
        if (!activeFilters) {
            return customers;
        }

        const now = new Date();
        const filterTags = activeFilters.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const lastOrderDays = activeFilters.lastOrderDays ? parseInt(activeFilters.lastOrderDays, 10) : null;
        const newCustomerDays = activeFilters.newCustomerDays ? parseInt(activeFilters.newCustomerDays, 10) : null;

        return customers.filter(customer => {
            // Tag filter
            if (filterTags.length > 0) {
                const customerTags = (customer.tags || []).map(t => t.toLowerCase());
                if (!filterTags.every(ft => customerTags.includes(ft))) {
                    return false;
                }
            }

            // Last order date filter
            if (lastOrderDays !== null && !isNaN(lastOrderDays)) {
                const lastOrder = lastOrderDateMap.get(customer.id);
                if (!lastOrder) {
                    // Customer never ordered, meets "haven't ordered in X days" criteria
                } else {
                    const daysSinceLastOrder = (now.getTime() - lastOrder.getTime()) / (1000 * 3600 * 24);
                    if (daysSinceLastOrder <= lastOrderDays) {
                        return false;
                    }
                }
            }
            
            // New customer filter
            if (newCustomerDays !== null && !isNaN(newCustomerDays)) {
                if (!customer.customerSince) return false; // Doesn't meet criteria if no join date
                const daysSinceJoined = (now.getTime() - new Date(customer.customerSince).getTime()) / (1000 * 3600 * 24);
                if (daysSinceJoined > newCustomerDays) {
                    return false;
                }
            }
            
            return true;
        });
    }, [activeFilters, customers, lastOrderDateMap]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleApplyFilters = () => {
        setActiveFilters({ ...filters });
    };

    const handleClearFilters = () => {
        setFilters({ tags: '', lastOrderDays: '', newCustomerDays: '' });
        setActiveFilters(null);
    };

    const tableHeaders = [
        { label: "Tên Khách hàng", icon: <UserIconLucide size={14} /> },
        { label: "SĐT", icon: <Phone size={14} /> },
        { label: "Tags", icon: <Tag size={14} /> },
        { label: "Đơn hàng cuối", icon: <CalendarDays size={14} /> },
        { label: "Ngày tham gia", icon: <CalendarDays size={14} /> },
    ];
    
    return (
        <div className="space-y-6">
            <Card title="Xây dựng Phân khúc Khách hàng" icon={<PieChartIcon size={24} className="text-brand-primary" />}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-border-base rounded-md bg-bg-subtle">
                    <Input
                        label="Chứa các thẻ (tags)"
                        name="tags"
                        value={filters.tags}
                        onChange={handleFilterChange}
                        placeholder="VIP, Corporate,..."
                    />
                    <Input
                        label="Chưa đặt hàng trong (ngày)"
                        name="lastOrderDays"
                        type="number"
                        value={filters.lastOrderDays}
                        onChange={handleFilterChange}
                        placeholder="VD: 60"
                    />
                    <Input
                        label="Khách hàng mới trong (ngày)"
                        name="newCustomerDays"
                        type="number"
                        value={filters.newCustomerDays}
                        onChange={handleFilterChange}
                        placeholder="VD: 30"
                    />
                </div>
                <div className="mt-4 flex space-x-2">
                    <Button onClick={handleApplyFilters} leftIcon={<FilterIcon size={16} />}>Áp dụng bộ lọc</Button>
                    <Button onClick={handleClearFilters} variant="secondary">Xóa bộ lọc</Button>
                </div>
            </Card>

            <Card title={`Kết quả (${filteredCustomers.length})`} icon={<UsersIcon size={20} className="text-brand-primary" />}>
                {filteredCustomers.length === 0 ? (
                    <p className="text-center text-text-muted py-10">Không có khách hàng nào phù hợp với bộ lọc.</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border-base">
                        <table className="min-w-full divide-y divide-border-base">
                            <thead className="bg-bg-subtle">
                                <tr>
                                    {tableHeaders.map(header => (
                                        <th key={header.label} className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                                            <div className="flex items-center">{header.icon}<span className="ml-1.5">{header.label}</span></div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-bg-surface divide-y divide-border-base">
                                {filteredCustomers.map(customer => {
                                    const lastOrder = lastOrderDateMap.get(customer.id);
                                    return (
                                        <tr key={customer.id} className="hover:bg-bg-surface-hover">
                                            <td className="px-5 py-4 whitespace-nowrap text-sm font-medium">
                                                <Link to={`/admin/customers/${customer.id}`} className="text-brand-primary hover:underline">{customer.name}</Link>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">{customer.phone}</td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">
                                                <div className="flex flex-wrap gap-1">
                                                    {(customer.tags || []).map(tag => (
                                                        <span key={tag} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">{tag}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">
                                                {lastOrder ? lastOrder.toLocaleDateString('vi-VN') : 'Chưa có'}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-text-body">
                                                {customer.customerSince ? new Date(customer.customerSince).toLocaleDateString('vi-VN') : 'N/A'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default CustomerSegmentsPage;