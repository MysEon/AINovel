"""
SSRF URL 白名单校验
拒绝访问内网、链路本地、回环等危险地址
"""

import ipaddress
from urllib.parse import urlparse

from app.core.exceptions import ValidationError


# 被拒绝的 IPv4 网段
_DISALLOWED_IPV4_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # loopback
    ipaddress.ip_network("10.0.0.0/8"),       # private
    ipaddress.ip_network("172.16.0.0/12"),    # private
    ipaddress.ip_network("192.168.0.0/16"),   # private
    ipaddress.ip_network("169.254.0.0/16"),   # link-local (含 AWS/GCP/Azure 元数据 169.254.169.254)
]

# 被拒绝的 IPv6 网段
_DISALLOWED_IPV6_NETWORKS = [
    ipaddress.ip_network("::1/128"),          # loopback
    ipaddress.ip_network("fc00::/7"),         # unique local
    ipaddress.ip_network("fe80::/10"),        # link-local
]

_DISALLOWED_LITERAL_HOSTS = {
    "0.0.0.0",
    "255.255.255.255",
    "::",
}


def _is_disallowed_ip(addr: ipaddress._BaseAddress) -> bool:
    """检查 IP 是否位于拒绝网段中"""
    if isinstance(addr, ipaddress.IPv4Address):
        for net in _DISALLOWED_IPV4_NETWORKS:
            if addr in net:
                return True
    elif isinstance(addr, ipaddress.IPv6Address):
        for net in _DISALLOWED_IPV6_NETWORKS:
            if addr in net:
                return True
    return False


def validate_outbound_url(url: str, allow_private: bool = False) -> str:
    """
    校验出站 URL 安全性

    - 仅允许 http / https scheme
    - 拒绝私有 IP、链路本地、回环、保留地址
    - 返回原始 url（已校验）
    """
    if allow_private:
        return url

    if not url:
        return url

    parsed = urlparse(url)

    # 1. scheme 限制
    if parsed.scheme not in ("http", "https"):
        raise ValidationError(f"不支持的 URL 协议: {parsed.scheme}（仅允许 http/https）")

    host = parsed.hostname
    if not host:
        raise ValidationError("URL 缺少主机名")

    # 2. 字面量拒绝
    if host.lower() in {"localhost", "localhost.localdomain"}:
        raise ValidationError("拒绝访问 localhost")

    if host in _DISALLOWED_LITERAL_HOSTS:
        raise ValidationError(f"拒绝访问保留地址: {host}")

    # 3. IP 地址解析与网段校验
    try:
        addr = ipaddress.ip_address(host)
        if _is_disallowed_ip(addr):
            raise ValidationError(f"拒绝访问内网/链路本地地址: {host}")
    except ValueError:
        # 不是 IP 地址，是域名，放行
        pass

    return url
