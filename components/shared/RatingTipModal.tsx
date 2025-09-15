

import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../../contexts/DataContext';
import { Order, User, ServiceRating, StaffRating } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { StarIcon, ShieldCheckIcon, GiftIcon, ChevronRightIcon } from 'lucide-react';

interface RatingTipModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  // FIX: Renamed prop to customerUserId to match usage.
  customerUserId: string;
}

type ModalStep = 'rating' | 'showContinueToTip' | 'tipping' | 'finalThankYou';

const StarRatingInput: React.FC<{ rating: number; setRating: (rating: number) => void; maxStars?: number, disabled?: boolean }> = 
  ({ rating, setRating, maxStars = 5, disabled = false }) => {
  return (
    <div className="flex space-x-1">
      {[...Array(maxStars)].map((_, index) => {
        const starValue = index + 1;
        return (
          <StarIcon
            key={starValue}
            size={28}
            className={`cursor-pointer transition-colors ${
              starValue <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !disabled && setRating(starValue)}
            aria-label={`Đánh giá ${starValue} sao`}
          />
        );
      })}
    </div>
  );
};

export const RatingTipModal: React.FC<RatingTipModalProps> = ({ isOpen, onClose, orderId, customerUserId }) => {
  const { 
    findOrder, 
    addServiceRating, 
    addStaffRating, 
    createTip, 
    getStaffForOrderActions,
    markNotificationAsRead,
    notifications,
    addNotification,
  } = useData();

  const [order, setOrder] = useState<Order | null>(null);
  const [pickupStaff, setPickupStaff] = useState<User | null>(null);
  const [returnStaff, setReturnStaff] = useState<User | null>(null);
  const [processingStaff, setProcessingStaff] = useState<User[]>([]);

  const [serviceRating, setServiceRating] = useState(0);
  const [serviceComment, setServiceComment] = useState('');

  const [pickupStaffRating, setPickupStaffRating] = useState(0);
  const [pickupStaffComment, setPickupStaffComment] = useState('');
  const [pickupStaffAnonymous, setPickupStaffAnonymous] = useState(true);

  const [returnStaffRating, setReturnStaffRating] = useState(0);
  const [returnStaffComment, setReturnStaffComment] = useState('');
  const [returnStaffAnonymous, setReturnStaffAnonymous] = useState(true);
  
  const [tipForPickupStaff, setTipForPickupStaff] = useState<number | ''>('');
  const [tipForReturnStaff, setTipForReturnStaff] = useState<number | ''>('');
  const [tipForTeam, setTipForTeam] = useState<number | ''>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<ModalStep>('rating');

  useEffect(() => {
    if (isOpen && orderId) {
      const foundOrder = findOrder(orderId);
      setOrder(foundOrder || null);
      if (foundOrder) {
        const staff = getStaffForOrderActions(orderId);
        setPickupStaff(staff.pickupStaff || null);
        setReturnStaff(staff.returnStaff || null);
        setProcessingStaff(staff.processingStaff || []);
      }
      // Reset state
      setCurrentStep('rating');
      setServiceRating(0);
      setServiceComment('');
      setPickupStaffRating(0);
      setPickupStaffComment('');
      setPickupStaffAnonymous(true);
      setReturnStaffRating(0);
      setReturnStaffComment('');
      setReturnStaffAnonymous(true);
      setTipForPickupStaff('');
      setTipForReturnStaff('');
      setTipForTeam('');
      setIsSubmitting(false);
    }
  }, [isOpen, orderId, findOrder, getStaffForOrderActions]);

  const handleSubmitRatings = async () => {
    if (!order || serviceRating === 0) {
      addNotification({ message: 'Vui lòng đánh giá chất lượng dịch vụ chung (ít nhất 1 sao).', type: 'warning', showToast: true });
      return;
    }
    setIsSubmitting(true);

    addServiceRating({ orderId, customerUserId, rating: serviceRating as ServiceRating['rating'], comment: serviceComment });

    if (pickupStaff && pickupStaffRating > 0) {
      addStaffRating({ 
        orderId, 
        customerUserId, 
        staffUserId: pickupStaff.id, 
        staffRoleInOrder: 'pickup',
        rating: pickupStaffRating as StaffRating['rating'], 
        comment: pickupStaffComment,
        isAnonymous: pickupStaffAnonymous,
      });
    }
    if (returnStaff && returnStaffRating > 0) {
      addStaffRating({ 
        orderId, 
        customerUserId, 
        staffUserId: returnStaff.id, 
        staffRoleInOrder: 'return',
        rating: returnStaffRating as StaffRating['rating'], 
        comment: returnStaffComment,
        isAnonymous: returnStaffAnonymous,
      });
    }
    
    addNotification({ message: 'Cảm ơn bạn đã gửi đánh giá!', type: 'success', showToast: true });

    const relatedNotification = notifications.find(n => n.orderId === orderId && n.type === 'rating_prompt');
    if (relatedNotification) {
      markNotificationAsRead(relatedNotification.id);
    }
    
    const canTipCurrentPickup = pickupStaff && pickupStaffRating === 5;
    const canTipCurrentReturn = returnStaff && returnStaffRating === 5;

    if (canTipCurrentPickup || canTipCurrentReturn || processingStaff.length > 0) {
      setCurrentStep('showContinueToTip');
    } else {
      setCurrentStep('finalThankYou');
    }
    setIsSubmitting(false);
  };

  const handleSubmitTips = () => {
    if (!order) return;
    setIsSubmitting(true);
    let tipMade = false;

    if (pickupStaff && tipForPickupStaff && +tipForPickupStaff > 0) {
      createTip({
        orderId,
        customerUserId,
        amount: +tipForPickupStaff,
        targetStaffUserId: pickupStaff.id,
        targetTeam: false,
        paymentMethodNotes: 'Online (Modal)'
      });
      tipMade = true;
    }
    if (returnStaff && tipForReturnStaff && +tipForReturnStaff > 0) {
      createTip({
        orderId,
        customerUserId,
        amount: +tipForReturnStaff,
        targetStaffUserId: returnStaff.id,
        targetTeam: false,
        paymentMethodNotes: 'Online (Modal)'
      });
      tipMade = true;
    }
    if (tipForTeam && +tipForTeam > 0) {
      createTip({
        orderId,
        customerUserId,
        amount: +tipForTeam,
        targetTeam: true,
        paymentMethodNotes: 'Online (Modal)'
      });
      tipMade = true;
    }

    if (tipMade) {
      addNotification({ message: 'Cảm ơn bạn đã tip!', type: 'success', showToast: true });
    }
    setIsSubmitting(false);
    onClose(); // Close modal after submitting tips
  };

  if (!isOpen || !order) return null;

  // Conditions to show tip options for staff (used within tipping step)
  const canTipPickup = pickupStaff && pickupStaffRating === 5;
  const canTipReturn = returnStaff && returnStaffRating === 5;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Đánh giá & Tip cho Đơn hàng ${order.id}`}
      size="xl"
    >
      <div className="space-y-5">
          {currentStep === 'rating' && (
            <>
              {/* Service Rating */}
              <div className="p-3 border border-border-base rounded-lg bg-bg-subtle/30 dark:bg-slate-700/20">
                <h4 className="font-semibold text-text-heading mb-2">1. Chất lượng dịch vụ chung:</h4>
                <StarRatingInput rating={serviceRating} setRating={setServiceRating} />
                <Input 
                  isTextArea 
                  label="Bình luận về dịch vụ (tùy chọn):" 
                  value={serviceComment} 
                  onChange={e => setServiceComment(e.target.value)} 
                  rows={2}
                  className="mt-2 text-sm"
                  placeholder="Chia sẻ cảm nhận của bạn..."
                />
              </div>

              {/* Pickup Staff Rating */}
              {pickupStaff && (
                <div className="p-3 border border-border-base rounded-lg bg-bg-subtle/30 dark:bg-slate-700/20">
                  <h4 className="font-semibold text-text-heading mb-2">2. Nhân viên nhận đồ ({pickupStaff.name}):</h4>
                  <StarRatingInput rating={pickupStaffRating} setRating={setPickupStaffRating} />
                  <Input 
                    isTextArea 
                    label="Bình luận (tùy chọn):" 
                    value={pickupStaffComment} 
                    onChange={e => setPickupStaffComment(e.target.value)} 
                    rows={2}
                    className="mt-2 text-sm"
                    placeholder={`Cảm nhận về nhân viên ${pickupStaff.name}...`}
                  />
                  <label className="flex items-center mt-2 text-sm text-text-muted">
                    <input 
                      type="checkbox" 
                      checked={pickupStaffAnonymous} 
                      onChange={e => setPickupStaffAnonymous(e.target.checked)} 
                      className="mr-2 rounded text-brand-primary focus:ring-brand-primary-focus"
                    />
                    Đánh giá ẩn danh
                  </label>
                </div>
              )}

              {/* Return Staff Rating */}
              {returnStaff && (
                <div className="p-3 border border-border-base rounded-lg bg-bg-subtle/30 dark:bg-slate-700/20">
                  <h4 className="font-semibold text-text-heading mb-2">3. Nhân viên trả đồ ({returnStaff.name}):</h4>
                  <StarRatingInput rating={returnStaffRating} setRating={setReturnStaffRating} />
                  <Input 
                    isTextArea 
                    label="Bình luận (tùy chọn):" 
                    value={returnStaffComment} 
                    onChange={e => setReturnStaffComment(e.target.value)} 
                    rows={2}
                    className="mt-2 text-sm"
                    placeholder={`Cảm nhận về nhân viên ${returnStaff.name}...`}
                  />
                  <label className="flex items-center mt-2 text-sm text-text-muted">
                    <input 
                      type="checkbox" 
                      checked={returnStaffAnonymous} 
                      onChange={e => setReturnStaffAnonymous(e.target.checked)} 
                      className="mr-2 rounded text-brand-primary focus:ring-brand-primary-focus"
                    />
                    Đánh giá ẩn danh
                  </label>
                </div>
              )}
              
              <Button onClick={handleSubmitRatings} className="w-full mt-4" disabled={isSubmitting || serviceRating === 0}>
                {isSubmitting ? 'Đang gửi...' : 'Gửi Đánh giá'}
              </Button>
            </>
          )}

          {currentStep === 'showContinueToTip' && (
            <div className="text-center py-4">
              <ShieldCheckIcon className="w-12 h-12 text-status-success mx-auto mb-3"/>
              <p className="text-text-heading font-semibold mb-4">Cảm ơn bạn đã đánh giá!</p>
              <Button onClick={() => setCurrentStep('tipping')} variant="primary" rightIcon={<ChevronRightIcon size={18}/>}>
                Tiếp tục để Tip
              </Button>
            </div>
          )}

          {currentStep === 'tipping' && (
            <div className="p-4 border-t border-dashed border-brand-primary mt-4 bg-teal-50 dark:bg-teal-800/20 rounded-lg">
              <h3 className="text-lg font-semibold text-brand-accent mb-3 flex items-center">
                <GiftIcon size={20} className="mr-2"/> Bạn có muốn tip không?
              </h3>
              <div className="space-y-3">
                {canTipPickup && pickupStaff && (
                  <div>
                    <label htmlFor="tipPickup" className="block text-sm font-medium text-text-body mb-1">Tip cho nhân viên nhận đồ ({pickupStaff.name}):</label>
                    <Input id="tipPickup" type="number" placeholder="Số tiền tip (VNĐ)" value={tipForPickupStaff} onChange={e => setTipForPickupStaff(e.target.value === '' ? '' : +e.target.value)} min="0" />
                  </div>
                )}
                {canTipReturn && returnStaff && (
                  <div>
                    <label htmlFor="tipReturn" className="block text-sm font-medium text-text-body mb-1">Tip cho nhân viên trả đồ ({returnStaff.name}):</label>
                    <Input id="tipReturn" type="number" placeholder="Số tiền tip (VNĐ)" value={tipForReturnStaff} onChange={e => setTipForReturnStaff(e.target.value === '' ? '' : +e.target.value)} min="0" />
                  </div>
                )}
                 {(pickupStaff || returnStaff || processingStaff.length > 0) && (
                    <div>
                        <label htmlFor="tipTeam" className="block text-sm font-medium text-text-body mb-1">Hoặc tip cho cả đội ngũ xử lý đơn hàng:</label>
                        <Input id="tipTeam" type="number" placeholder="Số tiền tip (VNĐ)" value={tipForTeam} onChange={e => setTipForTeam(e.target.value === '' ? '' : +e.target.value)} min="0" />
                    </div>
                 )}
              </div>
              <Button onClick={handleSubmitTips} className="w-full mt-5" disabled={isSubmitting}>
                {isSubmitting ? 'Đang xử lý...' : 'Gửi Tip & Hoàn tất'}
              </Button>
            </div>
          )}

          {currentStep === 'finalThankYou' && (
             <div className="text-center py-4">
               <ShieldCheckIcon className="w-12 h-12 text-status-success mx-auto mb-3"/>
               <p className="text-text-heading font-semibold">Đã ghi nhận đánh giá của bạn. Cảm ơn!</p>
                <Button onClick={onClose} className="mt-4">Đóng</Button>
             </div>
           )}
        </div>
    </Modal>
  );
};