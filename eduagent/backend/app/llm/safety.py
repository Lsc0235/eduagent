"""
内容安全与防幻觉机制
"""
import re
from typing import Optional, Tuple


# ─── 敏感词过滤 ───
SENSITIVE_PATTERNS = [
    r'(暴力|色情|赌博|毒品|诈骗)',
    r'(攻击|入侵|破解|木马|病毒)',
    r'(政治敏感|反动|颠覆)',
]


async def check_content_safety(text: str) -> Tuple[bool, Optional[str]]:
    """
    内容安全过滤
    返回: (是否安全, 不安全的描述)
    """
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, text):
            return False, f"内容包含敏感信息: {pattern}"
    return True, None


# ─── 防幻觉验证 ───

HALLUCINATION_INDICATORS = [
    # 过于确定的无源陈述
    r'(绝对|肯定|一定|必定|100%)',
    # 虚构的人物/事件
    r'(根据最新研究|根据最新报告|研究人员发现)',
    # 具体的数字/百分比（容易编造）
    r'(达到\d{2,3}%|提升了\d{2,}倍)',
]


async def verify_against_knowledge_base(
    generated_text: str,
    knowledge_context: str
) -> dict:
    """
    验证生成内容是否与知识库一致

    防幻觉策略:
    1. 如果知识库有上下文，检查生成内容是否与上下文一致
    2. 检测幻觉特征（过于确定的无源陈述等）
    3. 对关键事实做简单交叉验证
    """
    if not knowledge_context:
        return {
            "status": "no_context",
            "message": "知识库无相关内容，回答基于模型知识生成",
            "risk_level": "low",
            "verified": True,
        }

    # 检测幻觉特征
    risks = []
    for pattern in HALLUCINATION_INDICATORS:
        matches = re.findall(pattern, generated_text)
        if matches:
            risks.append(f"发现可疑表述: {matches[0] if isinstance(matches[0], str) else str(matches[0])[:30]}")

    # 简单关键词交叉验证
    verified_count = 0
    unchecked_count = 0
    # 提取生成内容中的关键术语
    key_terms = set(re.findall(r'[一-鿿]{2,5}', generated_text[:500]))
    for term in key_terms:
        if term in knowledge_context:
            verified_count += 1
        else:
            unchecked_count += 1

    total = verified_count + unchecked_count
    match_rate = verified_count / max(total, 1)

    if match_rate > 0.5:
        status = "ok"
        risk_level = "none"
    elif match_rate > 0.3:
        status = "warning"
        risk_level = "low"
    else:
        status = "caution"
        risk_level = "medium"

    return {
        "status": status,
        "message": f"知识库匹配率: {match_rate:.0%}",
        "risk_level": risk_level,
        "verified": match_rate > 0.3,
        "risks": risks[:3],
        "verification_details": {
            "matched_terms": verified_count,
            "unmatched_terms": unchecked_count,
            "match_rate": round(match_rate, 2),
        }
    }
