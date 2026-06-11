#!/usr/bin/env python3
"""
更新数据库中订单的证据字段
"""
import sqlite3
from datetime import datetime, timedelta

DB_PATH = "/Users/kuzhiluoya/Desktop/zqzl/yannis3213/trae-123-7/backend/venue_orders.db"

def update_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 检查是否已有证据字段
    cursor.execute("PRAGMA table_info(venue_orders)")
    columns = [col[1] for col in cursor.fetchall()]
    print(f"现有列: {columns}")
    
    # 如果没有证据字段，说明数据库没有被更新过，跳过
    if 'paymentAmount' not in columns:
        print("数据库还没有证据字段列，等待 TypeORM 自动添加...")
        conn.close()
        return
    
    today = datetime.now()
    
    # 更新订单 o1 (待补正，缺少支付凭证)
    cursor.execute("""
        UPDATE venue_orders SET
            paymentAmount = 200,
            paymentMethod = '微信支付',
            paymentStatus = '待核销',
            paymentVerification = NULL,
            admissionStatus = '待确认',
            admissionConfirmation = NULL,
            exceptionReason = '支付凭证不全',
            responsibleNode = 'registrar_missing_payment',
            auditRemark = '订单发起时未同步支付凭证',
            returnOpinion = '缺少支付凭证，请补充支付核销信息后重新提交'
        WHERE id = 'o1'
    """)
    
    # 更新订单 o2 (复核中)
    cursor.execute("""
        UPDATE venue_orders SET
            paymentAmount = 350,
            paymentMethod = '支付宝',
            paymentStatus = '已核销',
            paymentVerification = '订单号XD20260612002 已支付 核销时间 2026-06-12 10:30',
            admissionStatus = '待确认',
            admissionConfirmation = NULL,
            exceptionReason = NULL,
            responsibleNode = 'reviewer_approved',
            auditRemark = '支付核销凭证齐全，待复核入场信息'
        WHERE id = 'o2'
    """)
    
    # 更新订单 o3 (已完成)
    cursor.execute("""
        UPDATE venue_orders SET
            paymentAmount = 800,
            paymentMethod = '对公转账',
            paymentStatus = '已核销',
            paymentVerification = '订单号XD20260610001 已支付 核销时间 2026-06-10 14:20',
            admissionStatus = '已确认',
            admissionConfirmation = '入场时间 2026-06-12 09:55 确认人 王芳',
            exceptionReason = NULL,
            responsibleNode = 'approver_finalized',
            auditRemark = '订单完整归档，支付和入场均已确认'
        WHERE id = 'o3'
    """)
    
    # 更新订单 o4 (待审核)
    cursor.execute("""
        UPDATE venue_orders SET
            paymentAmount = 120,
            paymentMethod = '现金',
            paymentStatus = '已核销',
            paymentVerification = '订单号XD20260612003 已支付 核销时间 2026-06-12 09:15',
            admissionStatus = '待确认',
            admissionConfirmation = NULL,
            exceptionReason = NULL,
            responsibleNode = NULL,
            auditRemark = '新增订单，支付已完成，待审核主管审核'
        WHERE id = 'o4'
    """)
    
    # 更新订单 o5 (已逾期)
    cursor.execute("""
        UPDATE venue_orders SET
            paymentAmount = 150,
            paymentMethod = '微信支付',
            paymentStatus = '待核销',
            paymentVerification = NULL,
            admissionStatus = '待确认',
            admissionConfirmation = NULL,
            exceptionReason = '审核超时未处理，节点责任人：李明（审核主管）',
            responsibleNode = 'reviewer_overdue',
            auditRemark = '已逾期3天，责任节点为审核主管'
        WHERE id = 'o5'
    """)
    
    # 更新订单 o6 (审核中)
    cursor.execute("""
        UPDATE venue_orders SET
            paymentAmount = 180,
            paymentMethod = '会员卡',
            paymentStatus = '已核销',
            paymentVerification = '订单号XD20260611001 已支付 核销时间 2026-06-11 16:45',
            admissionStatus = '待确认',
            admissionConfirmation = NULL,
            exceptionReason = NULL,
            responsibleNode = NULL,
            auditRemark = '审核中，支付已确认，待审核主管确认'
        WHERE id = 'o6'
    """)
    
    # 更新处理记录的证据字段
    # 先检查处理记录表是否有证据列
    cursor.execute("PRAGMA table_info(processing_records)")
    pr_columns = [col[1] for col in cursor.fetchall()]
    print(f"处理记录表列: {pr_columns}")
    
    if 'paymentAmount' in pr_columns:
        # 更新 o1 的处理记录
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 200,
                paymentMethod = '微信支付',
                paymentStatus = '待核销',
                paymentVerification = NULL,
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                exceptionReason = NULL,
                responsibleNode = NULL,
                auditRemark = '订单发起时未同步支付凭证'
            WHERE orderId = 'o1' AND action = 'create'
        """)
        
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 200,
                paymentMethod = '微信支付',
                paymentStatus = '待核销',
                paymentVerification = NULL,
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                correctReason = '缺少支付凭证',
                returnOpinion = '缺少支付凭证，请补充支付核销信息后重新提交',
                exceptionReason = '支付凭证不全',
                responsibleNode = 'reviewer_returned',
                auditRemark = '退回补正，原因：缺少支付核销凭证'
            WHERE orderId = 'o1' AND action = 'return'
        """)
        
        # 更新 o2 的处理记录
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 350,
                paymentMethod = '支付宝',
                paymentStatus = '已核销',
                paymentVerification = '订单号XD20260612002 已支付 核销时间 2026-06-12 10:30',
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                exceptionReason = NULL,
                responsibleNode = NULL,
                auditRemark = '新增订单，支付已完成'
            WHERE orderId = 'o2' AND action = 'create'
        """)
        
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 350,
                paymentMethod = '支付宝',
                paymentStatus = '已核销',
                paymentVerification = '订单号XD20260612002 已支付 核销时间 2026-06-12 10:30',
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                returnOpinion = '材料齐全，同意上报审批',
                exceptionReason = NULL,
                responsibleNode = 'reviewer_approved',
                auditRemark = '审核通过，支付核销凭证齐全'
            WHERE orderId = 'o2' AND action = 'review_approve'
        """)
        
        # 更新 o3 的处理记录
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 800,
                paymentMethod = '对公转账',
                paymentStatus = '已核销',
                paymentVerification = '订单号XD20260610001 已支付 核销时间 2026-06-10 14:20',
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                exceptionReason = NULL,
                responsibleNode = NULL,
                auditRemark = '新增订单，支付已完成'
            WHERE orderId = 'o3' AND action = 'create'
        """)
        
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 800,
                paymentMethod = '对公转账',
                paymentStatus = '已核销',
                paymentVerification = '订单号XD20260610001 已支付 核销时间 2026-06-10 14:20',
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                returnOpinion = '审核通过，支付凭证齐全',
                exceptionReason = NULL,
                responsibleNode = 'reviewer_approved',
                auditRemark = '审核通过，支付核销已确认'
            WHERE orderId = 'o3' AND action = 'review_approve'
        """)
        
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 800,
                paymentMethod = '对公转账',
                paymentStatus = '已核销',
                paymentVerification = '订单号XD20260610001 已支付 核销时间 2026-06-10 14:20',
                admissionStatus = '已确认',
                admissionConfirmation = '入场时间 2026-06-12 09:55 确认人 王芳',
                returnOpinion = '审批通过，订单完成',
                exceptionReason = NULL,
                responsibleNode = 'approver_finalized',
                auditRemark = '复核通过，入场已确认，订单办结归档'
            WHERE orderId = 'o3' AND action = 'approve_finalize'
        """)
        
        # 更新 o4 的处理记录
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 120,
                paymentMethod = '现金',
                paymentStatus = '已核销',
                paymentVerification = '订单号XD20260612003 已支付 核销时间 2026-06-12 09:15',
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                exceptionReason = NULL,
                responsibleNode = NULL,
                auditRemark = '新增订单，支付已完成，待审核主管审核'
            WHERE orderId = 'o4' AND action = 'create'
        """)
        
        # 更新 o5 的处理记录
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 150,
                paymentMethod = '微信支付',
                paymentStatus = '待核销',
                paymentVerification = NULL,
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                exceptionReason = NULL,
                responsibleNode = NULL,
                auditRemark = '订单发起'
            WHERE orderId = 'o5' AND action = 'create'
        """)
        
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 150,
                paymentMethod = '微信支付',
                paymentStatus = '待核销',
                paymentVerification = NULL,
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                exceptionReason = '审核超时未处理，节点责任人：李明（审核主管）',
                responsibleNode = 'reviewer_overdue',
                auditRemark = '系统自动标记逾期，责任节点：审核主管'
            WHERE orderId = 'o5' AND action = 'overdue'
        """)
        
        # 更新 o6 的处理记录
        cursor.execute("""
            UPDATE processing_records SET
                paymentAmount = 180,
                paymentMethod = '会员卡',
                paymentStatus = '已核销',
                paymentVerification = '订单号XD20260611001 已支付 核销时间 2026-06-11 16:45',
                admissionStatus = '待确认',
                admissionConfirmation = NULL,
                exceptionReason = NULL,
                responsibleNode = NULL,
                auditRemark = '审核中，支付已确认'
            WHERE orderId = 'o6' AND action = 'create'
        """)
    
    conn.commit()
    conn.close()
    print("数据库证据字段更新完成！")

if __name__ == '__main__':
    update_database()
