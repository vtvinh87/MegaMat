
import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { User, Order, CrmTask, OrderStatus, UserRole } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import {
  ArrowLeftIcon, User as UserIcon, BarChart3Icon, MessageSquare, ListOrderedIcon, ClipboardListIcon,
  DollarSignIcon, CalendarDaysIcon, PackageIcon, TagIcon, SaveIcon, PlusCircleIcon, CheckIcon, SearchIcon, XIcon, HeartPulseIcon, RefreshCwIcon
} from 'lucide-react';

type ActiveTab = 'overview' | 'interactions' | 'orders' | 'tasks';

const EditableTags: React.FC<{ customer: User }> = ({ customer }) => {
    const { updateUser, addNotification } = useData();
    const [tags, setTags] = useState(customer.tags || []);
    const [newTag, setNewTag] = useState('');

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && newTag.trim()) {
            e.preventDefault();
            const tagToAdd = newTag.trim();
            if (!tags.map(t => t.toLowerCase()).includes(tagToAdd.toLowerCase())) {
                setTags([...tags, tagToAdd]);
            }
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleSaveTags = async () => {
        await updateUser({ id: customer.id, tags });
        addNotification({ message: 'Đã cập nhật thẻ tags.', type: 'success', showToast: true });
    };
    
    // Check for changes, ignoring order
    const hasChanges = useMemo(() => {
        const sortedCurrent = [...tags].sort();
        const sortedOriginal = [...(customer.tags || [])].sort();
        return JSON.stringify(sortedCurrent) !== JSON.stringify(sortedOriginal);
    }, [tags, customer.tags]);


    return (
        <Card title="Thẻ Tags" icon={<TagIcon size={18} />}>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[2rem]">
                {tags.map(tag => (
                    <span key={tag} className="flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {tag}
                        <button onClick={() => handleRemoveTag(tag)} className="ml-1.5 p-0.5 rounded-full hover:bg-blue-200">
                           <XIcon size={12} />
                        </button>
                    </span>
                ))}
            </div>
            <Input
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Thêm thẻ mới và nhấn Enter..."
            />
            <div className="text-right mt-4">
                <Button onClick={handleSaveTags} disabled={!hasChanges} leftIcon={<SaveIcon size={16} />}>
                    Lưu Tags
                </Button>
            </div>
        </Card>
    );
};

const CustomerHealthScoreWidget: React.FC<{ customer: User }> = ({ customer }) => {
    const { analyzeAndSetChurnRisk } = useData();
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        await analyzeAndSetChurnRisk(customer.id);
        setIsAnalyzing(false);
    };

    const churnPrediction = customer.churnPrediction;
    const probability = churnPrediction?.probability ?? -1;

    let riskColorClass = 'text-gray-500';
    let riskBgClass = 'bg-gray-100';
    let riskText = 'Chưa phân tích';

    if (probability >= 0) {
        if (probability >= 0.7) {
            riskColorClass = 'text-red-700';
            riskBgClass = 'bg-red-100';
            riskText = 'Rủi ro Cao';
        } else if (probability >= 0.3) {
            riskColorClass = 'text-amber-700';
            riskBgClass = 'bg-amber-100';
            riskText = 'Rủi ro Trung bình';
        } else {
            riskColorClass = 'text-green-700';
            riskBgClass = 'bg-green-100';
            riskText = 'Rủi ro Thấp';
        }
    }

    return (
        <Card title="Sức khỏe Khách hàng" icon={<HeartPulseIcon size={18} />}>
            <div className="space-y-4">
                <div>
                    <p className="text-sm text-text-muted">Tổng chi tiêu (CLV)</p>
                    <p className="text-2xl font-bold text-brand-primary">{(customer.lifetimeValue || 0).toLocaleString('vi-VN')} VNĐ</p>
                </div>
                <div>
                    <p className="text-sm text-text-muted">Dự đoán Rủi ro Rời bỏ (AI)</p>
                    <div className="flex items-center space-x-3 mt-1">
                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${riskBgClass} ${riskColorClass}`}>
                            {probability >= 0 ? `${(probability * 100).toFixed(0)}%` : 'N/A'}
                        </span>
                        <span className="font-semibold">{riskText}</span>
                    </div>
                </div>

                {churnPrediction && (
                    <div className="pt-3 border-t border-border-base">
                        <p className="text-sm font-semibold text-text-heading mb-1">Lý do chính (AI):</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-text-body">
                            {churnPrediction.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                        </ul>
                        <p className="text-xs text-text-muted mt-2">Phân tích lần cuối: {new Date(churnPrediction.lastAnalyzed).toLocaleString('vi-VN')}</p>
                    </div>
                )}
                
                <div className="text-right pt-3">
                    <Button onClick={handleAnalyze} disabled={isAnalyzing} leftIcon={<RefreshCwIcon size={16} className={isAnalyzing ? 'animate-spin' : ''}/>}>
                        {isAnalyzing ? "Đang phân tích..." : "Phân tích lại"}
                    </Button>
                </div>
            </div>
        </Card>
    );
};


const CustomerDetailPage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    findUserById, orders: allOrders, crmTasks: allCrmTasks, users,
    addUserInteraction, addCrmTask, updateCrmTask, updateUser, addNotification
  } = useData();

  const [customer, setCustomer] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  useEffect(() => {
    if (customerId) {
      const foundCustomer = findUserById(customerId);
      if (foundCustomer && foundCustomer.role === UserRole.CUSTOMER) {
        setCustomer(foundCustomer);
      } else {
        addNotification({ message: 'Không tìm thấy khách hàng.', type: 'error', showToast: true });
        navigate('/admin/customers');
      }
    }
  }, [customerId, findUserById, navigate, addNotification, users]); // Added `users` to dependency array to refetch customer on update

  const customerOrders = useMemo(() => {
    if (!customer) return [];
    return allOrders.filter(o => o.customer.id === customer.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [customer, allOrders]);
  
  const customerTasks = useMemo(() => {
    if (!customer) return [];
    return allCrmTasks.filter(t => t.customerId === customer.id)
      .sort((a,b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [customer, allCrmTasks]);

  const customerStats = useMemo(() => {
    const totalOrders = customerOrders.length;
    const lifetimeValue = customerOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const lastOrderDate = totalOrders > 0 ? customerOrders[0].createdAt : null;
    return { totalOrders, lifetimeValue, lastOrderDate };
  }, [customerOrders]);

  const renderTabButton = (tabId: ActiveTab, label: string, icon: React.ReactNode) => (
    <Button
      variant={activeTab === tabId ? 'primary' : 'ghost'}
      onClick={() => setActiveTab(tabId)}
      className="w-full justify-center"
      // FIX: The type assertion for the icon was too generic. Cast to a ReactElement that accepts a className.
      leftIcon={React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `mr-2 ${activeTab === tabId ? '' : 'text-brand-primary'}`})}
    >
      {label}
    </Button>
  );

  if (!customer) {
    return <Card title="Đang tải..."><p className="text-center">Đang tải thông tin khách hàng...</p></Card>;
  }

  // --- TAB COMPONENTS ---

  const OverviewTab: React.FC = () => {
    const [notes, setNotes] = useState(customer.notes || '');
    const handleSaveNotes = async () => {
      await updateUser({ id: customer.id, notes });
      addNotification({ message: 'Đã cập nhật ghi chú.', type: 'success', showToast: true });
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <CustomerHealthScoreWidget customer={customer} />
          <EditableTags customer={customer} />
        </div>
        <div className="md:col-span-2">
          <Card title="Ghi chú chung" icon={<MessageSquare size={18} />}>
            <Input isTextArea rows={8} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ghi chú quan trọng, không thay đổi thường xuyên về khách hàng..."/>
            <div className="text-right mt-4">
              <Button onClick={handleSaveNotes} leftIcon={<SaveIcon size={16} />} disabled={notes === (customer.notes || '')}>Lưu Ghi chú</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  };
  
  const InteractionLogTab: React.FC = () => {
    const [summary, setSummary] = useState('');
    const [channel, setChannel] = useState<'phone' | 'in-person' | 'sms' | 'email' | 'other'>('in-person');
    
    const handleSubmitInteraction = (e: FormEvent) => {
      e.preventDefault();
      if (!summary.trim()) return;
      addUserInteraction(customer.id, { channel, summary });
      setSummary('');
      setChannel('in-person');
    };

    return (
      <div className="space-y-6">
        <Card title="Ghi nhận Tương tác Mới">
          <form onSubmit={handleSubmitInteraction} className="space-y-3">
            <Select
              label="Kênh tương tác"
              value={channel}
              onChange={e => setChannel(e.target.value as any)}
              options={[
                { value: 'in-person', label: 'Trực tiếp' },
                { value: 'phone', label: 'Điện thoại' },
                { value: 'sms', label: 'Tin nhắn SMS' },
                { value: 'email', label: 'Email' },
                { value: 'other', label: 'Khác' },
              ]}
            />
            <Input isTextArea rows={3} label="Tóm tắt nội dung*" value={summary} onChange={e => setSummary(e.target.value)} required placeholder="VD: Khách gọi hỏi về chương trình khuyến mãi cho giặt khô..."/>
            <div className="text-right">
              <Button type="submit">Lưu Tương tác</Button>
            </div>
          </form>
        </Card>
        <Card title="Lịch sử Tương tác">
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {customer.interactionHistory && customer.interactionHistory.length > 0 ? (
                customer.interactionHistory.map((entry, index) => (
                  <div key={index} className="flex space-x-3 border-b border-border-base pb-3 last:border-b-0">
                      <div className="flex-shrink-0 text-center">
                          <p className="font-bold text-lg">{new Date(entry.timestamp).getDate()}</p>
                          <p className="text-xs text-text-muted">Thg {new Date(entry.timestamp).getMonth() + 1}</p>
                      </div>
                      <div className="flex-grow">
                          <p className="text-sm">{entry.summary}</p>
                          <p className="text-xs text-text-muted mt-1">
                            Qua <span className="font-semibold">{entry.channel}</span> bởi <span className="font-semibold">{findUserById(entry.staffUserId)?.name || 'N/A'}</span>
                          </p>
                      </div>
                  </div>
                ))
              ) : <p className="text-sm text-text-muted text-center">Chưa có tương tác nào được ghi nhận.</p>}
            </div>
        </Card>
      </div>
    );
  };
  
  const OrderHistoryTab: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const filteredOrders = useMemo(() => {
        if (!searchTerm) return customerOrders;
        return customerOrders.filter(o => o.id.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, customerOrders]);

    return (
        <Card title="Lịch sử Đơn hàng" icon={<ListOrderedIcon size={18}/>}>
            <Input placeholder="Tìm theo Mã ĐH..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} leftIcon={<SearchIcon/>}/>
            <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {filteredOrders.length > 0 ? filteredOrders.map(order => (
                    <div key={order.id} className="p-3 border border-border-base rounded-lg">
                        <div className="flex justify-between items-center">
                            <Link to={`/admin/orders/${order.id}`} className="font-semibold text-brand-primary hover:underline">{order.id}</Link>
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">{order.status}</span>
                        </div>
                        <p className="text-sm text-text-muted mt-1">Ngày tạo: {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
                        <p className="text-sm font-semibold mt-1">Tổng tiền: {order.totalAmount.toLocaleString('vi-VN')} VNĐ</p>
                    </div>
                )) : <p className="text-center text-text-muted py-4">Không tìm thấy đơn hàng.</p>}
            </div>
        </Card>
    );
  };
  
  const TasksTab: React.FC = () => {
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', assignedToUserId: '' });
    
    const staffAndManagers = useMemo(() => users.filter(u => u.role === UserRole.STAFF || u.role === UserRole.MANAGER), [users]);

    const handleToggleTask = (task: CrmTask) => {
        updateCrmTask({ id: task.id, status: task.status === 'pending' ? 'completed' : 'pending' });
    };

    const handleSaveNewTask = (e: FormEvent) => {
        e.preventDefault();
        if (!newTask.title || !newTask.dueDate || !newTask.assignedToUserId) return;
        addCrmTask({
            ...newTask,
            customerId: customer.id,
            status: 'pending',
            dueDate: new Date(newTask.dueDate)
        });
        setIsTaskModalOpen(false);
    };

    return (
        <>
        <Card title="Công việc CRM" icon={<ClipboardListIcon size={18}/>} actions={<Button onClick={() => { setNewTask({ title: '', description: '', dueDate: '', assignedToUserId: '' }); setIsTaskModalOpen(true); }} leftIcon={<PlusCircleIcon size={16}/>}>Tạo Công việc</Button>}>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {customerTasks.length > 0 ? customerTasks.map(task => (
                    <div key={task.id} className={`p-3 border rounded-lg flex items-start space-x-3 ${task.status === 'completed' ? 'bg-bg-subtle opacity-70' : 'bg-bg-surface'}`}>
                        <input type="checkbox" checked={task.status === 'completed'} onChange={() => handleToggleTask(task)} className="mt-1 h-5 w-5 rounded text-brand-primary focus:ring-brand-primary-focus"/>
                        <div className="flex-grow">
                            <p className={`font-semibold ${task.status === 'completed' ? 'line-through' : ''}`}>{task.title}</p>
                            <p className="text-sm text-text-muted">{task.description}</p>
                            <div className="text-xs text-text-muted mt-1 flex space-x-4">
                                <span>Hạn: {new Date(task.dueDate).toLocaleDateString('vi-VN')}</span>
                                <span>Giao cho: {findUserById(task.assignedToUserId)?.name || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                )) : <p className="text-center text-text-muted py-4">Không có công việc nào.</p>}
            </div>
        </Card>
        <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Tạo Công việc Mới">
            <form onSubmit={handleSaveNewTask} className="space-y-4">
                <Input label="Tiêu đề*" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} required/>
                <Input isTextArea rows={3} label="Mô tả" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                <Input label="Ngày hết hạn*" type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} required/>
                <Select label="Giao cho*" value={newTask.assignedToUserId} onChange={e => setNewTask({...newTask, assignedToUserId: e.target.value})} options={staffAndManagers.map(u => ({ value: u.id, label: u.name }))} required/>
                <div className="flex justify-end space-x-2 pt-4 border-t border-border-base">
                    <Button type="button" variant="secondary" onClick={() => setIsTaskModalOpen(false)}>Hủy</Button>
                    <Button type="submit">Lưu</Button>
                </div>
            </form>
        </Modal>
        </>
    );
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => navigate('/admin/customers')} className="p-2">
          <ArrowLeftIcon />
        </Button>
        <h1 className="text-3xl font-bold text-text-heading flex items-center">
          <UserIcon size={28} className="mr-3 text-brand-primary" /> {customer.name}
        </h1>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-b border-border-base pb-4 mb-6">
          {renderTabButton('overview', 'Tổng quan', <BarChart3Icon />)}
          {renderTabButton('interactions', 'Tương tác', <MessageSquare />)}
          {renderTabButton('orders', 'Đơn hàng', <ListOrderedIcon />)}
          {renderTabButton('tasks', 'Công việc', <ClipboardListIcon />)}
        </div>
        
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'interactions' && <InteractionLogTab />}
        {activeTab === 'orders' && <OrderHistoryTab />}
        {activeTab === 'tasks' && <TasksTab />}
      </Card>
    </div>
  );
};

export default CustomerDetailPage;
