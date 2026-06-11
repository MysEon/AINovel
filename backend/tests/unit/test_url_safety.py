"""URL 安全校验单元测试"""

import pytest

from app.core.url_safety import validate_outbound_url
from app.core.exceptions import ValidationError


class TestUrlSafety:
    def test_reject_metadata_ip(self):
        with pytest.raises(ValidationError) as exc:
            validate_outbound_url("http://169.254.169.254/latest/meta-data/")
        assert "169.254.169.254" in str(exc.value)

    def test_reject_private_ip_10(self):
        with pytest.raises(ValidationError) as exc:
            validate_outbound_url("http://10.0.0.1/")
        assert "10.0.0.1" in str(exc.value)

    def test_reject_localhost(self):
        with pytest.raises(ValidationError) as exc:
            validate_outbound_url("http://localhost/")
        assert "localhost" in str(exc.value)

    def test_reject_ftp_scheme(self):
        with pytest.raises(ValidationError) as exc:
            validate_outbound_url("ftp://example.com/")
        assert "ftp" in str(exc.value)

    def test_allow_public_https(self):
        url = validate_outbound_url("https://api.openai.com/v1/chat/completions")
        assert url == "https://api.openai.com/v1/chat/completions"

    def test_reject_ipv6_loopback(self):
        with pytest.raises(ValidationError) as exc:
            validate_outbound_url("http://[::1]/")
        assert "::1" in str(exc.value) or "拒绝" in str(exc.value)

    def test_reject_ipv6_link_local(self):
        with pytest.raises(ValidationError) as exc:
            validate_outbound_url("http://[fe80::1%25eth0]/")
        assert "fe80" in str(exc.value) or "拒绝" in str(exc.value)

    def test_allow_private_when_flag_true(self):
        url = validate_outbound_url("http://localhost/", allow_private=True)
        assert url == "http://localhost/"
