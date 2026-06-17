"""
自测脚本 — 验证所有核心功能是否可用
运行方式: python test_self.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# 先加载 .env
from dotenv import load_dotenv
load_dotenv()

import asyncio
import json
import httpx


async def test_1_spark_api():
    """测试星火 API 是否可用"""
    print("=" * 50)
    print("测试1: 星火 API 连接")
    from app.llm.spark_client import SparkClient
    spark = SparkClient()
    try:
        result = await asyncio.wait_for(spark.chat("请回复：连通测试成功"), timeout=30)
        print(f"   ✅ API 连接成功")
        print(f"   回复前50字: {result[:50]}")
        return True
    except Exception as e:
        print(f"   ❌ API 连接失败: {e}")
        return False


async def test_2_database():
    """测试数据库"""
    print("=" * 50)
    print("测试2: 数据库连接")
    try:
        from app.models.database import init_db, async_session, ChatSession, Student
        from sqlalchemy import select

        await init_db()
        print("   ✅ 数据库初始化成功")

        async with async_session() as db:
            result = await db.execute(select(Student).where(Student.student_id == "test_user"))
            if not result.scalar_one_or_none():
                db.add(Student(student_id="test_user", name="测试用户"))
                await db.commit()
            print("   ✅ 数据库读写正常")
        return True
    except Exception as e:
        print(f"   ❌ 数据库错误: {e}")
        return False


async def test_3_chat():
    """测试对话功能"""
    print("=" * 50)
    print("测试3: 对话功能")
    try:
        from app.llm.spark_client import SparkClient
        spark = SparkClient()

        # 测试带系统提示词的对话
        prompt = "请用一句话介绍你自己"
        system = "你是一位AI学习助手"
        result = await asyncio.wait_for(spark.chat(prompt, system_prompt=system), timeout=30)

        print(f"   ✅ 对话功能正常")
        print(f"   回复前80字: {result[:80]}")
        return True
    except Exception as e:
        print(f"   ❌ 对话失败: {e}")
        return False


async def test_4_profile_extraction():
    """测试画像提取"""
    print("=" * 50)
    print("测试4: 画像提取")
    try:
        from app.llm.spark_client import SparkClient
        spark = SparkClient()

        prompt = """从以下对话提取学生信息，返回JSON：
用户说: 我是计算机专业大三学生，学过Python和数据结构，想学机器学习
只返回JSON，不要其他内容。"""

        result = await asyncio.wait_for(spark.chat(prompt), timeout=30)
        result = result.strip()
        if "```" in result:
            result = result.split("```")[1]
            if result.startswith("json"):
                result = result[4:]

        data = json.loads(result)
        print(f"   ✅ 画像提取成功")
        print(f"   提取字段: {list(data.keys())}")
        return True
    except Exception as e:
        print(f"   ❌ 画像提取失败: {e}")
        return False


async def test_5_resource_generation():
    """测试资源生成"""
    print("=" * 50)
    print("测试5: 资源生成")
    try:
        from app.llm.spark_client import SparkClient
        spark = SparkClient()

        prompt = '''你是一位AI课程教师。请为"机器学习"生成一段课程讲解，300字左右。直接输出内容。'''
        result = await asyncio.wait_for(spark.chat(prompt), timeout=45)

        if len(result) > 100:
            print(f"   ✅ 资源生成成功 ({len(result)}字)")
        else:
            print(f"   ❌ 生成内容太短: ({len(result)}字)")
        print(f"   预览: {result[:100]}...")
        return len(result) > 50
    except Exception as e:
        print(f"   ❌ 资源生成失败: {e}")
        return False


async def test_6_learning_path():
    """测试学习路径规划"""
    print("=" * 50)
    print("测试6: 学习路径规划")
    try:
        from app.llm.spark_client import SparkClient
        import json
        spark = SparkClient()

        prompt = '''你是一位课程规划专家。请为"人工智能导论"规划学习路径。返回JSON。
只返回JSON: {"nodes":[{"id":"1","title":"概述","description":"了解AI基本概念","difficulty":"easy","estimated_time":"2小时","status":"not_started"}],
"recommendation":"按顺序学习"}

请返回5个节点。'''

        result = await asyncio.wait_for(spark.chat(prompt), timeout=45)
        result = result.strip()
        if "```" in result:
            result = result.split("```")[1]
            if result.startswith("json"):
                result = result[4:]

        data = json.loads(result)
        nodes = data.get("nodes", [])
        print(f"   ✅ 路径规划成功 ({len(nodes)}个节点)")
        for n in nodes:
            print(f"      - {n.get('title', '?')} ({n.get('difficulty', '?')})")
        return len(nodes) >= 3
    except Exception as e:
        print(f"   ❌ 路径规划失败: {e}")
        return False


async def test_7_evaluation():
    """测试学习评估"""
    print("=" * 50)
    print("测试7: 学习评估")
    try:
        from app.llm.spark_client import SparkClient
        spark = SparkClient()

        prompt = '''生成一份学习评估报告JSON。只返回JSON:
{"overall_score":75,"dimensions":{"knowledge_mastery":{"score":70,"comment":"良好"},"learning_efficiency":{"score":80,"comment":"较好"}},"strengths":["积极学习"],"weaknesses":["练习不足"],"recommendations":["多做练习题"],"next_focus":"巩固基础"}'''

        result = await asyncio.wait_for(spark.chat(prompt), timeout=30)
        result = result.strip()
        if "```" in result:
            result = result.split("```")[1]
            if result.startswith("json"):
                result = result[4:]

        data = json.loads(result)
        print(f"   ✅ 评估生成成功 (评分: {data.get('overall_score', '?')})")
        return "overall_score" in data
    except Exception as e:
        print(f"   ❌ 评估生成失败: {e}")
        return False


async def main():
    print("\n╔══════════════════════════════════════╗")
    print("║   智学通 EduAgent - 全功能自测     ║")
    print("╚══════════════════════════════════════╝\n")

    results = {}

    # 串联测试（不能并发的功能就不并发）
    results["API连接"] = await test_1_spark_api()

    if results["API连接"]:
        results["数据库"] = await test_2_database()
        results["对话功能"] = await test_3_chat()
        results["画像提取"] = await test_4_profile_extraction()
        results["资源生成"] = await test_5_resource_generation()
        results["路径规划"] = await test_6_learning_path()
        results["评估报告"] = await test_7_evaluation()
    else:
        print("\n⚠️ API 连接失败，停止后续测试。请检查 .env 配置。")

    # 汇总
    print("\n" + "=" * 50)
    print("测试结果汇总:")
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    for name, ok in results.items():
        print(f"  {'✅' if ok else '❌'} {name}: {'通过' if ok else '失败'}")
    print(f"\n通过: {passed}/{total}")

    if passed == total:
        print("🎉 所有测试通过！系统可以正常使用。")
    else:
        print("⚠️ 部分测试失败，需要修复。")


if __name__ == "__main__":
    asyncio.run(main())
